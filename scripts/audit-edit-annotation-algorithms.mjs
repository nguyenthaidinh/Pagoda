// Regression verification of the previously reproduced edit/annotation defects.
// Runs current source with real PDF engines; exit 0 requires corrected results.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as PDF from 'pdf-lib';
import JSZip from 'jszip';
import createQpdf from '@neslinesli93/qpdf-wasm';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { createEngineModule } from '../src/js/editcore/engine-loader.js';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const out = resolve('output/pdf/edit-annotation-audit/fixed');
mkdirSync(out, { recursive: true });
const report = {
  method:
    'Actual TS functions extracted by AST; real qpdf, pdf-lib and PDF.js; UI adapters only.',
  checks: [],
  controls: [],
};
const qpdf = await createQpdf({
  wasmBinary: readFileSync(
    'node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'
  ),
  noInitialRun: true,
});
const noop = () => {};
const hexToRgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255,
});
const openPdf = (bytes) =>
  pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl:
      resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
    useSystemFonts: true,
  });

function source(path) {
  const text = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  assert.equal(ast.parseDiagnostics.length, 0, `Invalid source: ${path}`);
  return ast;
}

function evaluate(context, text, path) {
  const compiled = ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const ast = ts.createSourceFile(path, compiled, ts.ScriptTarget.Latest, true);
  const names = ast.statements.flatMap((node) => {
    if (ts.isFunctionDeclaration(node) && node.name) return [node.name.text];
    if (ts.isVariableStatement(node))
      return node.declarationList.declarations
        .filter((d) => ts.isIdentifier(d.name))
        .map((d) => d.name.text);
    return [];
  });
  // Keep arrays in the same JS realm: pdf-lib validates using instanceof Array.
  new Function(
    'scope',
    `with (scope) {\n${compiled}\nObject.assign(scope, {${names.join(',')}});\n}`
  )(context);
}

function functions(context, path, names) {
  const ast = source(path);
  for (const name of names) {
    const node = ast.statements.find(
      (s) => ts.isFunctionDeclaration(s) && s.name?.text === name
    );
    assert.ok(node, `Missing function ${name} in ${path}`);
    evaluate(context, node.getText(ast), path);
  }
}

function constants(context, path, names) {
  const ast = source(path);
  for (const name of names) {
    const statement = ast.statements.find(
      (s) =>
        ts.isVariableStatement(s) &&
        s.declarationList.declarations.some((d) => d.name.getText(ast) === name)
    );
    assert.ok(statement, `Missing constant ${name}`);
    evaluate(context, statement.getText(ast), path);
  }
}

function clickHandler(context, path, element) {
  const ast = source(path);
  const matches = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(ast) === element &&
      node.expression.name.text === 'addEventListener' &&
      node.arguments[0]?.text === 'click'
    ) {
      matches.push(node.arguments[1]);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(matches.length, 1);
  evaluate(
    context,
    `globalThis.auditClick = ${matches[0].getText(ast)};`,
    path
  );
}

function environment(values = {}, extra = {}) {
  const downloads = [];
  const errors = [];
  const context = {
    ...PDF,
    PDFLibDocument: PDF.PDFDocument,
    exports: {},
    console: {
      ...console,
      error: (...args) => errors.push(args.map(String).join(' ')),
    },
    Uint8Array,
    ArrayBuffer,
    Blob,
    JSZip,
    setTimeout,
    resetToUploader: noop,
    createEngineModule,
    t: (key) => key,
    showLoader: noop,
    hideLoader: noop,
    resetState: noop,
    showAlert: (title, msg) => {
      if (title === 'common.error') errors.push(msg);
    },
    showAlertModal: async (title, msg) => {
      if (title === 'common.error') errors.push(msg);
    },
    downloadFile: (blob, name) => downloads.push({ blob, name }),
    document: {
      getElementById: (id) => ({ value: values[id] ?? '' }),
      createElement: (tag) => {
        assert.equal(tag, 'canvas');
        return createCanvas(1, 1);
      },
    },
    hexToRgb,
    getPDFDocument: openPdf,
    readFileAsArrayBuffer: (file) => file.arrayBuffer(),
    canvasToBlob: async (canvas) => new Blob([canvas.toBuffer('image/png')]),
    // ASCII-only audit fixtures use the same standard-font branch as the app.
    embedFontForText: (doc, _text, font) => doc.embedFont(font),
    initializeQpdf: async () => qpdf,
    ...extra,
  };
  context.globalThis = context;
  functions(context, 'src/js/utils/load-pdf-document.ts', [
    'repairPdfBytes',
    'loadPdfDocument',
  ]);
  functions(context, 'src/js/utils/pdf-page-space.ts', [
    'getVisualPageSpace',
    'drawInVisualPageSpace',
  ]);
  functions(context, 'src/js/utils/pdf-background.ts', [
    'prependPageBackgrounds',
  ]);
  functions(context, 'src/js/utils/deduplicate-filename.ts', [
    'deduplicateFileName',
  ]);
  functions(context, 'src/js/utils/bookmark-target.ts', [
    'sanitizeBookmarkTarget',
  ]);
  functions(context, 'src/js/utils/pdf-text-color.ts', [
    'prepareTextColorDocument',
    'restoreTextColorForms',
    'recolorTextPages',
    'recolorPdfText',
  ]);
  return { context, downloads, errors };
}

async function downloaded(env, name) {
  assert.deepEqual(
    env.errors,
    [],
    'Processing must finish without swallowed errors'
  );
  assert.equal(env.downloads.length, 1);
  const bytes = new Uint8Array(await env.downloads[0].blob.arrayBuffer());
  writeFileSync(resolve(out, name), bytes);
  return bytes;
}

async function render(bytes, name) {
  const doc = await openPdf(bytes).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const ctx = canvas.getContext('2d');
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    if (name)
      writeFileSync(resolve(out, name + '.png'), canvas.toBuffer('image/png'));
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return { width: canvas.width, height: canvas.height, pixels };
  } finally {
    await doc.destroy();
  }
}

function countPixels(rendered, predicate) {
  let count = 0;
  for (let i = 0; i < rendered.pixels.length; i += 4) {
    if (predicate(...rendered.pixels.subarray(i, i + 3))) count++;
  }
  return count;
}

async function location(bytes, text) {
  const doc = await openPdf(bytes).promise;
  try {
    const page = await doc.getPage(1);
    const item = (await page.getTextContent()).items.find(
      (i) => i.str === text
    );
    assert.ok(item, `Missing text ${text}`);
    const viewport = page.getViewport({ scale: 1 });
    const [x, y] = viewport.convertToViewportPoint(
      item.transform[4],
      item.transform[5]
    );
    return { x: x / viewport.width, y: y / viewport.height };
  } finally {
    await doc.destroy();
  }
}

async function fixture({
  rotate = 0,
  crop = false,
  form = false,
  colors = false,
  label = 'AUDIT DOCUMENT',
} = {}) {
  const doc = await PDF.PDFDocument.create();
  const page = doc.addPage([600, 800]);
  page.drawText(label, { x: 50, y: 720, size: 20 });
  if (rotate) page.setRotation(PDF.degrees(rotate));
  if (crop) {
    page.setCropBox(350, 500, 200, 250);
    page.drawText('VISIBLE AREA', { x: 370, y: 700, size: 16 });
  }
  if (form) {
    const field = doc.getForm().createTextField('customer');
    field.setText('CUSTOMER ALPHA');
    field.addToPage(page, { x: 50, y: 500, width: 250, height: 50 });
    doc
      .getForm()
      .updateFieldAppearances(await doc.embedFont(PDF.StandardFonts.Helvetica));
  }
  if (colors) {
    page.drawText('RED TEXT', {
      x: 50,
      y: 620,
      size: 30,
      color: PDF.rgb(1, 0, 0),
    });
    page.drawRectangle({
      x: 50,
      y: 400,
      width: 150,
      height: 100,
      color: PDF.rgb(0, 0, 0),
    });
  }
  return new Uint8Array(await doc.save());
}

// Background-color output must retain filled widget content and page geometry.
const formInput = await fixture({ form: true });
writeFileSync(resolve(out, 'background-form-before.pdf'), formInput);
const backgroundPath = 'src/js/logic/background-color-page.ts';
async function background(bytes, name) {
  const env = environment({ 'background-color': '#cceeff' });
  env.context.pageState = {
    file: { name: 'input.pdf' },
    pdfDoc: await env.context.loadPdfDocument(bytes),
  };
  functions(env.context, backgroundPath, ['changeBackgroundColor']);
  await env.context.changeBackgroundColor();
  return downloaded(env, name);
}
const formOutput = await background(formInput, 'background-form-after.pdf');
const fieldsBefore = (await PDF.PDFDocument.load(formInput))
  .getForm()
  .getFields().length;
const fieldsAfter = (await PDF.PDFDocument.load(formOutput))
  .getForm()
  .getFields().length;
assert.equal(fieldsBefore, 1);
assert.equal(fieldsAfter, 1);
assert.equal(
  (await PDF.PDFDocument.load(formOutput))
    .getForm()
    .getTextField('customer')
    .getText(),
  'CUSTOMER ALPHA'
);
await render(formInput, 'background-form-before');
await render(formOutput, 'background-form-after');
report.checks.push({
  id: 'background-form-loss',
  fieldsBefore,
  fieldsAfter,
  evidence: 'background-form-before/after.pdf and PNG',
});
const croppedRotated = await fixture({ rotate: 90, crop: true });
writeFileSync(resolve(out, 'background-geometry-before.pdf'), croppedRotated);
const geometryOutput = await background(
  croppedRotated,
  'background-geometry-after.pdf'
);
const beforeGeometry = await render(
  croppedRotated,
  'background-geometry-before'
);
const afterGeometry = await render(geometryOutput, 'background-geometry-after');
assert.deepEqual([beforeGeometry.width, beforeGeometry.height], [250, 200]);
assert.deepEqual([afterGeometry.width, afterGeometry.height], [250, 200]);
assert.equal(
  (await PDF.PDFDocument.load(geometryOutput)).getPage(0).getRotation().angle,
  90
);
report.checks.push({
  id: 'background-crop-rotation-loss',
  before: [250, 200, 90],
  after: [
    afterGeometry.width,
    afterGeometry.height,
    (await PDF.PDFDocument.load(geometryOutput)).getPage(0).getRotation().angle,
  ],
});

// Coordinate controls compare displayed page positions, not raw PDF coordinates.
const operationsPath = 'src/js/utils/pdf-operations.ts';
const operations = environment();
functions(operations.context, operationsPath, [
  'addPageNumbers',
  'addImageWatermark',
]);
const plain = await fixture();
const rotated = await fixture({ rotate: 90 });
const numbering = {
  position: 'bottom-center',
  fontSize: 20,
  format: 'simple',
  color: { r: 0, g: 0, b: 0 },
};
const plainNumbers = await operations.context.addPageNumbers(plain, numbering);
const rotatedNumbers = await operations.context.addPageNumbers(
  rotated,
  numbering
);
const normalPosition = await location(plainNumbers, '1');
const rotatedPosition = await location(rotatedNumbers, '1');
assert.ok(normalPosition.y > 0.9 && normalPosition.x > 0.45);
assert.ok(
  rotatedPosition.x > 0.45 &&
    rotatedPosition.x < 0.55 &&
    rotatedPosition.y > 0.9
);
writeFileSync(resolve(out, 'page-numbers-rotated.pdf'), rotatedNumbers);
await render(rotatedNumbers, 'page-numbers-rotated');
report.checks.push({
  id: 'page-numbers-rotation',
  normalPosition,
  rotatedPosition,
});
report.controls.push('Page numbers bottom-center on unrotated page');

const mark = createCanvas(40, 40);
const markCtx = mark.getContext('2d');
markCtx.fillStyle = '#ff0000';
markCtx.fillRect(0, 0, 40, 40);
const markOptions = {
  imageBytes: mark.toBuffer('image/png'),
  imageType: 'png',
  scale: 1,
  angle: 0,
  opacity: 1,
  x: 0.5,
  y: 0.5,
};
const markPlain = await operations.context.addImageWatermark(
  plain,
  markOptions
);
const markCrop = await operations.context.addImageWatermark(
  await fixture({ crop: true }),
  markOptions
);
const isRed = (r, g, b) => r > 200 && g < 40 && b < 40;
const visibleMark = countPixels(
  await render(markPlain, 'watermark-normal'),
  isRed
);
const missingMark = countPixels(
  await render(markCrop, 'watermark-cropped'),
  isRed
);
assert.ok(visibleMark > 1000);
assert.equal(missingMark, 1600);
writeFileSync(resolve(out, 'watermark-cropped.pdf'), markCrop);
report.checks.push({
  id: 'watermark-outside-crop',
  visibleRedPixelsNormal: visibleMark,
  visibleRedPixelsCropped: missingMark,
});
report.controls.push('Image watermark visible at center of un-cropped page');

// Real multi-file export, including JSZip, with two independent File objects.
const batesPath = 'src/js/logic/bates-numbering-page.ts';
async function bates(names, bytes = plain) {
  const env = environment(
    {
      'bates-template': '[BATES]',
      'bates-start': '1',
      'file-start': '1',
      position: 'bottom-center',
      'font-family': 'Helvetica',
      'font-size': '20',
      'text-color': '#000000',
      'style-preset': 'custom',
      'bates-padding': '6',
    },
    {
      files: names.map((name, index) => ({
        file: new File([Array.isArray(bytes) ? bytes[index] : bytes], name),
        pageCount: 1,
      })),
    }
  );
  constants(env.context, batesPath, ['FONT_MAP', 'STYLE_PRESETS']);
  functions(env.context, batesPath, [
    'formatBatesText',
    'getActivePadding',
    'calculatePosition',
    'applyBatesNumbers',
  ]);
  await env.context.applyBatesNumbers();
  return env;
}
const batchInputs = [plain, await fixture({ label: 'SECOND DOCUMENT' })];
const uniqueZip = await JSZip.loadAsync(
  await downloaded(
    await bates(['first.pdf', 'second.pdf'], batchInputs),
    'bates-unique.zip'
  )
);
const duplicateZip = await JSZip.loadAsync(
  await downloaded(
    await bates(['report.pdf', 'report.pdf'], batchInputs),
    'bates-duplicate.zip'
  )
);
assert.equal(Object.keys(uniqueZip.files).length, 2);
assert.equal(Object.keys(duplicateZip.files).length, 2);
const remainingBates = await duplicateZip
  .file('report.pdf')
  .async('uint8array');
await location(remainingBates, '000001');
await location(remainingBates, 'AUDIT DOCUMENT');
const secondBates = await duplicateZip
  .file('report (1).pdf')
  .async('uint8array');
await location(secondBates, '000002');
await location(secondBates, 'SECOND DOCUMENT');
report.checks.push({
  id: 'bates-overwrite',
  inputFiles: 2,
  outputFiles: 2,
  numbers: ['000001', '000002'],
});
report.controls.push('Bates produces two PDFs for distinct filenames');
const rotatedBates = await downloaded(
  await bates(['rotated.pdf'], rotated),
  'bates-rotated.pdf'
);
const batesPosition = await location(rotatedBates, '000001');
assert.ok(
  batesPosition.x > 0.4 && batesPosition.x < 0.5 && batesPosition.y > 0.9
);
report.checks.push({ id: 'bates-rotation', position: batesPosition });

async function headerFooter(bytes, name) {
  const env = environment(
    { 'header-center': 'HEADER', 'font-size': '20' },
    {
      pageState: {
        file: { name: 'header.pdf' },
        pdfDoc: await PDF.PDFDocument.load(bytes),
      },
    }
  );
  functions(env.context, 'src/js/utils/helpers.ts', ['parsePageRangesStrict']);
  functions(env.context, 'src/js/logic/header-footer-page.ts', [
    'addHeaderFooter',
  ]);
  await env.context.addHeaderFooter();
  return downloaded(env, name);
}
const headerNormal = await headerFooter(plain, 'header-normal.pdf');
const headerRotated = await headerFooter(rotated, 'header-rotated.pdf');
const headerNormalPosition = await location(headerNormal, 'HEADER');
const headerRotatedPosition = await location(headerRotated, 'HEADER');
assert.ok(headerNormalPosition.y < 0.1);
assert.ok(
  headerRotatedPosition.x > 0.4 &&
    headerRotatedPosition.x < 0.5 &&
    headerRotatedPosition.y < 0.1
);
await render(headerRotated, 'header-rotated');
report.checks.push({
  id: 'header-footer-rotation',
  normalPosition: headerNormalPosition,
  rotatedPosition: headerRotatedPosition,
});
report.controls.push('Header appears at top-center on an unrotated page');

// The Crop tool is a contrasting control: it maps visual corners through PDF.js.
const cropDoc = await openPdf(croppedRotated).promise;
try {
  const env = environment(
    {},
    { cropperState: { originalPdfBytes: croppedRotated, pdfDoc: cropDoc } }
  );
  functions(env.context, 'src/js/logic/crop-pdf-page.ts', [
    'performMetadataCrop',
  ]);
  const cropOutput = await env.context.performMetadataCrop({
    1: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  });
  const outputDoc = await PDF.PDFDocument.load(cropOutput);
  const box = outputDoc.getPage(0).getCropBox();
  assert.deepEqual(box, { x: 370, y: 525, width: 160, height: 200 });
  assert.equal(outputDoc.getPage(0).getRotation().angle, 90);
  report.controls.push(
    'Metadata crop correctly maps a cropped, 90-degree rotated page and retains rotation'
  );
} finally {
  await cropDoc.destroy();
}

// Text-color operation on an actual page containing text and a black rectangle.
const colors = await fixture({ colors: true });
const colorEnv = environment(
  { 'text-color-input': '#00ff00' },
  {
    pageState: {
      file: new File([colors], 'colors.pdf'),
      pdfDoc: await PDF.PDFDocument.load(colors),
    },
  }
);
functions(colorEnv.context, 'src/js/logic/text-color-page.ts', [
  'changeTextColor',
]);
await colorEnv.context.changeTextColor();
const recolored = await downloaded(colorEnv, 'text-color-after.pdf');
writeFileSync(resolve(out, 'text-color-before.pdf'), colors);
const colorBefore = await render(colors, 'text-color-before');
const colorAfter = await render(recolored, 'text-color-after');
const rectIndex = (350 * colorAfter.width + 100) * 4;
const rectangleAfter = [...colorAfter.pixels.slice(rectIndex, rectIndex + 3)];
assert.deepEqual(rectangleAfter, [0, 0, 0]);
assert.equal(countPixels(colorAfter, isRed), 0);
await location(recolored, 'RED TEXT');
report.checks.push({
  id: 'text-color-wrong-target',
  blackRectangleAfter: rectangleAfter,
  redTextPixelsBefore: countPixels(colorBefore, isRed),
  redTextPixelsAfter: countPixels(colorAfter, isRed),
});

// Bookmark import/export preserves XYZ as a control, but misreads FitH and URL.
const bookmarkDoc = await PDF.PDFDocument.load(plain);
const root = bookmarkDoc.context.obj({ Type: 'Outlines' });
const rootRef = bookmarkDoc.context.register(root);
const entries = [
  {
    Title: PDF.PDFHexString.fromText('FitH'),
    Dest: [bookmarkDoc.getPage(0).ref, 'FitH', 700],
  },
  {
    Title: PDF.PDFHexString.fromText('XYZ'),
    Dest: [bookmarkDoc.getPage(0).ref, 'XYZ', 50, 700, 1],
  },
  {
    Title: PDF.PDFHexString.fromText('Website'),
    A: { S: 'URI', URI: PDF.PDFString.of('https://example.com/') },
  },
].map((entry) => bookmarkDoc.context.obj({ ...entry, Parent: rootRef }));
const refs = entries.map((entry) => bookmarkDoc.context.register(entry));
entries.forEach((entry, i) => {
  if (i) entry.set(PDF.PDFName.of('Prev'), refs[i - 1]);
  if (i + 1 < refs.length) entry.set(PDF.PDFName.of('Next'), refs[i + 1]);
});
root.set(PDF.PDFName.of('First'), refs[0]);
root.set(PDF.PDFName.of('Last'), refs.at(-1));
root.set(PDF.PDFName.of('Count'), PDF.PDFNumber.of(3));
bookmarkDoc.catalog.set(PDF.PDFName.of('Outlines'), rootRef);
const bookmarkInput = await bookmarkDoc.save();
writeFileSync(resolve(out, 'bookmarks-before.pdf'), bookmarkInput);
const outlineDoc = await openPdf(bookmarkInput).promise;
try {
  const bookmarkPath = 'src/js/logic/bookmark-pdf.ts';
  const env = environment(
    {},
    {
      pdfJsDoc: outlineDoc,
      pdfLibDoc: bookmarkDoc,
      originalFileName: 'bookmarks',
    }
  );
  functions(env.context, bookmarkPath, [
    'cleanTitle',
    'extractExistingBookmarks',
  ]);
  env.context.bookmarkTree = await env.context.extractExistingBookmarks();
  clickHandler(env.context, bookmarkPath, 'downloadBtn');
  await env.context.auditClick();
  const bookmarkOutput = await downloaded(env, 'bookmarks-after.pdf');
  const afterDoc = await openPdf(bookmarkOutput).promise;
  try {
    const before = await outlineDoc.getOutline();
    const after = await afterDoc.getOutline();
    assert.equal(before[0].dest[1].name, 'FitH');
    assert.deepEqual(before[0].dest.slice(1), after[0].dest.slice(1));
    assert.deepEqual(before[1].dest.slice(1), after[1].dest.slice(1));
    assert.equal(before[2].url, 'https://example.com/');
    assert.equal(after[2].url, before[2].url);
    assert.equal(after[2].dest, null);
    report.checks.push({
      id: 'bookmark-destination-corruption',
      fitHBefore: before[0].dest.slice(1),
      fitHAfter: after[0].dest.slice(1),
      urlBefore: before[2].url,
      urlAfter: after[2].url ?? null,
      urlReplacement: after[2].dest,
    });
    report.controls.push(
      'XYZ bookmark coordinates preserved through import/export'
    );
  } finally {
    await afterDoc.destroy();
  }
} finally {
  await outlineDoc.destroy();
}

writeFileSync(
  resolve(out, 'report.json'),
  JSON.stringify(report, null, 2) + '\n'
);
console.log(JSON.stringify(report, null, 2));
console.log(`Evidence: ${out}`);
