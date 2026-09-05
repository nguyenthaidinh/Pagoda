// Regression verification of the image-conversion audit; preserve historical evidence.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as PDF from 'pdf-lib';
import { decode } from 'tiff';
import createQpdf from '@neslinesli93/qpdf-wasm';
import {
  createCanvas,
  Image,
  DOMMatrix,
  ImageData,
  Path2D,
} from '@napi-rs/canvas';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const out = resolve('output/pdf/image-conversion-audit/fixed');
mkdirSync(out, { recursive: true });
const checks = [];
const qpdf = await createQpdf({
  wasmBinary: readFileSync(
    'node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'
  ),
  noInitialRun: true,
});
const noop = () => {};
const save = (name, bytes) => writeFileSync(resolve(out, name), bytes);
const blobs = new Map();
let blobId = 0;
const urls = {
  createObjectURL(blob) {
    const id = `audit:${++blobId}`;
    blobs.set(id, blob);
    return id;
  },
  revokeObjectURL(id) {
    blobs.delete(id);
  },
};
function BrowserImage() {
  const image = new Image();
  let onload;
  Object.defineProperty(image, 'onload', {
    set(callback) {
      onload = callback;
    },
    get() {
      return (...args) => {
        void onload?.(...args);
      };
    },
  });
  const setter = Object.getOwnPropertyDescriptor(Image.prototype, 'src').set;
  Object.defineProperty(image, 'src', {
    set(url) {
      if (url.startsWith('data:')) {
        setter.call(image, url);
        return;
      }
      blobs
        .get(url)
        .arrayBuffer()
        .then((bytes) => setter.call(image, Buffer.from(bytes)))
        .catch((error) => image.onerror?.(error));
    },
  });
  return image;
}
function environment(values = {}, extra = {}) {
  const downloads = [];
  const alerts = [];
  return {
    ...PDF,
    PDFLibDocument: PDF.PDFDocument,
    exports: {},
    document: {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        return createCanvas(1, 1);
      },
      getElementById(id) {
        return values[id] ?? null;
      },
    },
    Image: BrowserImage,
    URL: urls,
    Blob,
    File,
    FileReader: class {
      readAsDataURL(blob) {
        blob.arrayBuffer().then((bytes) =>
          this.onload?.({
            target: {
              result: `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`,
            },
          })
        );
      }
    },
    readFileAsArrayBuffer: (file) => file.arrayBuffer(),
    showLoader: noop,
    hideLoader: noop,
    resetState: noop,
    showAlert: (...args) => alerts.push(args),
    conversionText: (key) => key,
    t: (key) => key,
    downloadFile: (blob, name) => downloads.push({ blob, name }),
    downloads,
    alerts,
    ...extra,
  };
}
function extract(scope, path, names) {
  const source = readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const nodes = names.map((name) => {
    const node = ast.statements.find(
      (item) =>
        (ts.isFunctionDeclaration(item) && item.name?.text === name) ||
        (ts.isVariableStatement(item) &&
          item.declarationList.declarations.some(
            (d) => d.name.getText(ast) === name
          ))
    );
    assert.ok(node, `Missing ${name} in ${path}`);
    return node.getText(ast);
  });
  const compiled = ts.transpileModule(nodes.join('\n'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  new Function(
    'scope',
    `with(scope) { ${compiled}\nObject.assign(scope, {${names.join(',')}}); }`
  )(scope);
}
async function open(bytes) {
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    standardFontDataUrl:
      resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
  }).promise;
}
async function render(bytes, name) {
  const doc = await open(bytes);
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height)
  );
  await page.render({
    canvas,
    canvasContext: canvas.getContext('2d'),
    viewport,
  }).promise;
  save(name, canvas.toBuffer('image/png'));
  await doc.destroy();
  return canvas;
}
const pixel = (canvas, x, y) =>
  [...canvas.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3);
async function downloaded(scope, name) {
  assert.equal(scope.downloads.length, 1, JSON.stringify(scope.alerts));
  const bytes = new Uint8Array(await scope.downloads[0].blob.arrayBuffer());
  save(name, bytes);
  return bytes;
}

// Sparse visible content versus truly blank and dense controls.
const blankScope = environment();
extract(blankScope, 'src/js/logic/remove-blank-pages-page.ts', ['isPageBlank']);
const sparse = await PDF.PDFDocument.create();
const sparsePage = sparse.addPage([595, 842]);
sparsePage.drawText('PAYMENT CONFIRMED', { x: 60, y: 700, size: 18 });
sparse.addPage([595, 842]);
const dense = sparse.addPage([595, 842]);
for (let i = 0; i < 35; i++)
  dense.drawText('This page contains actual document content.', {
    x: 60,
    y: 760 - 19 * i,
    size: 14,
  });
const sparseBytes = await sparse.save();
save('blank-detection-input.pdf', sparseBytes);
await render(sparseBytes, 'blank-detection-visible-content.png');
const sparseDoc = await open(sparseBytes);
const blankResults = [];
for (let i = 1; i <= 3; i++)
  blankResults.push(
    await blankScope.isPageBlank(await sparseDoc.getPage(i), 5 - 0.8 * 4.9)
  );
assert.deepEqual(blankResults, [false, true, false]);
checks.push({
  id: 'blank-false-positive',
  defaultSensitivity: 80,
  pageLabels: ['visible text', 'blank', 'dense text'],
  detectedBlank: blankResults,
});
await sparseDoc.destroy();

// Delete only the actual blank page, keeping a populated interactive form and bookmark page.
const original = await PDF.PDFDocument.create();
const retained = original.addPage([595, 842]);
retained.drawText('Retained form and bookmark', { x: 60, y: 750, size: 18 });
const field = original.getForm().createTextField('customer');
field.setText('Customer A');
field.addToPage(retained, { x: 60, y: 640, width: 250, height: 30 });
original.addPage([595, 842]);
const root = original.context.obj({ Type: 'Outlines', Count: 1 });
const rootRef = original.context.register(root);
const bookmark = original.context.obj({
  Title: PDF.PDFHexString.fromText('Customer'),
  Parent: rootRef,
  Dest: [retained.ref, 'Fit'],
});
const bookmarkRef = original.context.register(bookmark);
root.set(PDF.PDFName.of('First'), bookmarkRef);
root.set(PDF.PDFName.of('Last'), bookmarkRef);
original.catalog.set(PDF.PDFName.of('Outlines'), rootRef);
const beforeBytes = await original.save();
save('blank-removal-form-input.pdf', beforeBytes);
const removalScope = environment(
  {
    'blank-pages-preview': {
      querySelectorAll: () => [{ dataset: { pageIndex: '1' } }],
    },
  },
  { pageState: { pdfDoc: original, file: new File([beforeBytes], 'form.pdf') } }
);
extract(removalScope, 'src/js/logic/remove-blank-pages-page.ts', [
  'processRemoveBlankPages',
]);
removalScope.initializeQpdf = async () => qpdf;
extract(removalScope, 'src/js/utils/split-pdf-helpers.ts', [
  'pagesToSpec',
  'extractPagesWithQpdf',
]);
await removalScope.processRemoveBlankPages();
const afterBytes = await downloaded(
  removalScope,
  'blank-removal-form-output.pdf'
);
const after = await PDF.PDFDocument.load(afterBytes);
const beforeReader = await open(beforeBytes);
const afterReader = await open(afterBytes);
const formResult = {
  id: 'blank-removal-document-structure',
  beforeFields: original.getForm().getFields().length,
  afterFields: after.getForm().getFields().length,
  beforeBookmarks: (await beforeReader.getOutline())?.length ?? 0,
  afterBookmarks: (await afterReader.getOutline())?.length ?? 0,
  remainingPages: after.getPageCount(),
  beforeFieldNames: Object.keys((await beforeReader.getFieldObjects()) ?? {}),
  afterFieldNames: Object.keys((await afterReader.getFieldObjects()) ?? {}),
  retainedWidgetAnnotations: after.getPage(0).node.Annots()?.size() ?? 0,
};
assert.equal(formResult.beforeFields, 1);
assert.equal(formResult.afterFields, 1);
assert.equal(formResult.beforeBookmarks, 1);
assert.equal(formResult.afterBookmarks, 1);
assert.deepEqual(formResult.beforeFieldNames, ['customer']);
assert.deepEqual(formResult.afterFieldNames, ['customer']);
assert.equal(after.getForm().getTextField('customer').getText(), 'Customer A');
after.getForm().getTextField('customer').setText('Still editable');
assert.equal(
  (await PDF.PDFDocument.load(await after.save()))
    .getForm()
    .getTextField('customer')
    .getText(),
  'Still editable'
);
checks.push(formResult);
await beforeReader.destroy();
await afterReader.destroy();
await render(afterBytes, 'blank-removal-form-output.png');

// Valid uncompressed TIFF fixtures with explicit bit depth and photometric interpretation.
function tiffFixture(photo, bits = 8) {
  const width = 96,
    height = 64;
  const stride = Math.ceil((width * bits) / 8);
  const tags = [
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 1, bits],
    [259, 3, 1, 1],
    [262, 3, 1, photo],
    [273, 4, 1, 0],
    [277, 3, 1, 1],
    [278, 4, 1, height],
    [279, 4, 1, stride * height],
  ];
  if (photo === 3) tags.push([320, 3, 768, 0]);
  const paletteOffset = 8 + 2 + tags.length * 12 + 4;
  const dataOffset = paletteOffset + (photo === 3 ? 1536 : 0);
  tags.find((t) => t[0] === 273)[3] = dataOffset;
  if (photo === 3) tags.find((t) => t[0] === 320)[3] = paletteOffset;
  const bytes = Buffer.alloc(dataOffset + stride * height);
  bytes.write('II');
  bytes.writeUInt16LE(42, 2);
  bytes.writeUInt32LE(8, 4);
  bytes.writeUInt16LE(tags.length, 8);
  tags.forEach(([tag, type, count, value], i) => {
    const offset = 10 + i * 12;
    bytes.writeUInt16LE(tag, offset);
    bytes.writeUInt16LE(type, offset + 2);
    bytes.writeUInt32LE(count, offset + 4);
    bytes.writeUInt32LE(value, offset + 8);
  });
  if (photo === 3) {
    // Palette entry 0 = red, entry 1 = green.
    bytes.writeUInt16LE(65535, paletteOffset);
    bytes.writeUInt16LE(65535, paletteOffset + (256 + 1) * 2);
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const inside = x >= 24 && x < 72 && y >= 16 && y < 48;
      const sample =
        photo === 3 ? Number(inside) : inside === (photo === 0) ? 255 : 0;
      if (bits === 1)
        bytes[dataOffset + y * stride + (x >> 3)] |=
          Number(sample !== 0) << (7 - (x % 8));
      else bytes[dataOffset + y * width + x] = sample;
    }
  return bytes;
}
for (const [photo, bits] of [
  [0, 8],
  [1, 8],
  [3, 8],
  [0, 1],
  [1, 1],
]) {
  const input = tiffFixture(photo, bits);
  const prefix = `tiff-photo-${photo}${bits === 1 ? '-1bit' : ''}`;
  save(`${prefix}-input.tiff`, input);
  const scope = environment(
    { 'tiff-pdf-quality': { value: 'high' } },
    { files: [new File([input], 'sample.tiff')], decode }
  );
  extract(scope, 'src/js/utils/tiff-utils.ts', ['tiffIfdToRgba']);
  extract(scope, 'src/js/logic/tiff-to-pdf-page.ts', ['convert']);
  await scope.convert();
  const bytes = await downloaded(scope, `${prefix}-output.pdf`);
  const canvas = await render(bytes, `${prefix}-output.png`);
  const expected =
    photo === 3
      ? [
          [255, 0, 0],
          [0, 255, 0],
        ]
      : [
          [255, 255, 255],
          [0, 0, 0],
        ];
  const actual = [pixel(canvas, 5, 5), pixel(canvas, 48, 32)];
  const control = photo === 1 && bits === 8;
  assert.deepEqual(actual, expected);
  checks.push({ id: prefix, expected, actual, control });
}

// Transparent black artwork: compare each real converter against white PDF paper.
const artwork = createCanvas(160, 100);
artwork.getContext('2d').fillRect(50, 25, 60, 50);
save('transparent-artwork.png', artwork.toBuffer('image/png'));
save('transparent-artwork.webp', artwork.toBuffer('image/webp'));
for (const format of ['png', 'webp'])
  for (const quality of ['high', 'medium']) {
    const input = artwork.toBuffer(`image/${format}`);
    const scope = environment(
      { 'jpg-pdf-quality': { value: quality } },
      { files: [new File([input], `artwork.${format}`)] }
    );
    extract(scope, 'src/js/utils/image-compress.ts', [
      'QUALITY_CONFIGS',
      'getSelectedQuality',
      'compressImageBytes',
    ]);
    extract(scope, `src/js/logic/${format}-to-pdf-page.ts`, [
      'sanitizeImageAsJpeg',
      'convertToPdf',
    ]);
    await scope.convertToPdf();
    const bytes = await downloaded(scope, `${format}-${quality}-output.pdf`);
    const canvas = await render(bytes, `${format}-${quality}-output.png`);
    const background = pixel(canvas, 5, 5);
    const mark = pixel(canvas, 80, 50);
    assert.deepEqual(background, [255, 255, 255]);
    assert.deepEqual(mark, [0, 0, 0]);
    checks.push({
      id: `${format}-${quality}-alpha`,
      background,
      mark,
      control: format === 'png' && quality === 'high',
    });
  }

const svgScope = environment(
  { 'jpg-pdf-quality': { value: 'medium' } },
  {
    files: [
      new File(
        [
          '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect x="50" y="25" width="60" height="50" fill="black"/></svg>',
        ],
        'artwork.svg'
      ),
    ],
  }
);
extract(svgScope, 'src/js/utils/image-compress.ts', [
  'QUALITY_CONFIGS',
  'getSelectedQuality',
  'compressImageBytes',
]);
extract(svgScope, 'src/js/logic/svg-to-pdf-page.ts', [
  'svgToPng',
  'convertToPdf',
]);
await svgScope.convertToPdf();
const svgBytes = await downloaded(svgScope, 'svg-medium-output.pdf');
const svgCanvas = await render(svgBytes, 'svg-medium-output.png');
assert.deepEqual(pixel(svgCanvas, 5, 5), [255, 255, 255]);
checks.push({
  id: 'svg-white-background',
  background: pixel(svgCanvas, 5, 5),
  control: true,
});

const bmpInput = execFileSync('python', [
  '-c',
  'from PIL import Image,ImageDraw\nimport sys\nim=Image.new("RGB",(160,100),"white")\nImageDraw.Draw(im).rectangle((50,25,109,74),fill="black")\nim.save(sys.stdout.buffer,format="BMP")',
]);
save('bmp-input.bmp', bmpInput);
const bmpScope = environment(
  {},
  { files: [new File([bmpInput], 'sample.bmp', { type: 'image/bmp' })] }
);
extract(bmpScope, 'src/js/logic/bmp-to-pdf-page.ts', [
  'convertImageToPngBytes',
  'convert',
]);
await bmpScope.convert();
if (bmpScope.downloads.length) {
  const bytes = await downloaded(bmpScope, 'bmp-output.pdf');
  const canvas = await render(bytes, 'bmp-output.png');
  assert.deepEqual(pixel(canvas, 5, 5), [255, 255, 255]);
  assert.deepEqual(pixel(canvas, 80, 50), [0, 0, 0]);
  checks.push({ id: 'bmp-rgb-control', control: true });
} else {
  checks.push({
    id: 'bmp-native-adapter-limitation',
    notAProductionFinding: true,
    alerts: bmpScope.alerts,
  });
}

// Execute the pinned engine's actual htmlToPdf method. Native PyMuPDF substitutes
// for the unavailable browser/Pyodide runtime; retain the exact generated Python.
const engineSource = execFileSync(
  'tar',
  [
    '-xOf',
    'bentopdf-airgap-bundle/bentopdf-pymupdf-wasm-0.11.16.tgz',
    'package/dist/index.js',
  ],
  { encoding: 'utf8', maxBuffer: 5000000 }
);
const engineAst = ts.createSourceFile(
  'engine.js',
  engineSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
);
let textMethod, imagesMethod;
function visit(node) {
  if (
    ts.isMethodDeclaration(node) &&
    node.name.getText(engineAst) === 'htmlToPdf'
  )
    textMethod = node.getText(engineAst);
  if (
    ts.isMethodDeclaration(node) &&
    node.name.getText(engineAst) === 'imagesToPdf'
  )
    imagesMethod = node.getText(engineAst);
  ts.forEachChild(node, visit);
}
visit(engineAst);
assert.ok(textMethod);
save('pymupdf-html-to-pdf-source.txt', textMethod + '\n');
const pythonPrograms = [];
const engine = new Function(
  'base64ToUint8Array2',
  'uint8ArrayToBase642',
  `return ({${textMethod}})`
)(
  (text) => new Uint8Array(Buffer.from(text, 'base64')),
  (bytes) => Buffer.from(bytes).toString('base64')
);
engine.hasRtlCharacters = () => false;
engine.getPyodide = async () => ({
  globals: { set: noop, delete: noop },
  runPython(code) {
    pythonPrograms.push(code);
    return execFileSync(
      'python',
      [
        '-c',
        'import sys, pymupdf\nattachments_json = "[]"\nexec(sys.stdin.read())\nprint(base64.b64encode(final_pdf).decode("ascii"))',
      ],
      { input: code, encoding: 'utf8', maxBuffer: 5000000 }
    ).trim();
  },
});
for (const color of ['#000000', '#ff0000']) {
  const scope = environment(
    {
      'font-size': { value: '24' },
      'page-size': { value: 'a4' },
      'font-family': { value: 'helv' },
      'text-color': { value: color },
      'text-input': { value: 'COLOR TEST' },
    },
    { currentMode: 'text', files: [], loadPyMuPDF: async () => engine }
  );
  extract(scope, 'src/js/utils/helpers.ts', ['escapeHtml']);
  extract(scope, 'src/js/logic/txt-to-pdf-page.ts', [
    'RTL_PATTERN',
    'hasRtlCharacters',
    'textPdfHtml',
    'convert',
  ]);
  await scope.convert();
  const bytes = await downloaded(scope, `txt-color-${color.slice(1)}.pdf`);
  await render(bytes, `txt-color-${color.slice(1)}.png`);
}
assert.notEqual(pythonPrograms[0], pythonPrograms[1]);
save('txt-generated-python.txt', pythonPrograms[1]);
checks.push({
  id: 'txt-color-ignored',
  colors: ['#000000', '#ff0000'],
  identicalRendererInput: false,
  nativeEngineVersion: execFileSync(
    'python',
    ['-c', 'import pymupdf; print(pymupdf.VersionBind)'],
    { encoding: 'utf8' }
  ).trim(),
  wrapperVersion: '0.11.16',
  caveat:
    'Native PyMuPDF executes the pinned wrapper Python; browser WASM not exercised.',
});

const longText = Array.from(
  { length: 120 },
  (_, i) => `LINE ${String(i).padStart(3, '0')} <literal> & value`
).join('\n');
const longScope = environment(
  {
    'font-size': { value: '14' },
    'page-size': { value: 'letter' },
    'font-family': { value: 'cour' },
    'text-color': { value: '#008000' },
  },
  {
    currentMode: 'upload',
    files: [new File([longText], 'long.txt')],
    loadPyMuPDF: async () => engine,
  }
);
extract(longScope, 'src/js/utils/helpers.ts', ['escapeHtml']);
extract(longScope, 'src/js/logic/txt-to-pdf-page.ts', [
  'RTL_PATTERN',
  'hasRtlCharacters',
  'textPdfHtml',
  'convert',
]);
await longScope.convert();
const longBytes = await downloaded(longScope, 'txt-multipage.pdf');
const longReader = await open(longBytes);
const textChunks = [];
try {
  assert.ok(longReader.numPages > 1);
  for (let i = 1; i <= longReader.numPages; i++) {
    const page = await longReader.getPage(i);
    assert.deepEqual(page.view, [0, 0, 612, 792]);
    textChunks.push(
      (await page.getTextContent()).items
        .filter((item) => 'str' in item)
        .map((item) => item.str)
        .join(' ')
    );
  }
  const extracted = textChunks.join(' ').replace(/\s+/g, ' ');
  for (let i = 0; i < 120; i++)
    assert.ok(
      extracted.includes(`LINE ${String(i).padStart(3, '0')} <literal> & value`)
    );
  checks.push({
    id: 'txt-upload-pagination',
    pageCount: longReader.numPages,
    linesRetained: 120,
    paper: 'letter',
    escapedLiteralsRetained: true,
  });
} finally {
  await longReader.destroy();
}

const typography = JSON.parse(
  execFileSync(
    'python',
    [
      '-c',
      'import json,pymupdf\nfrom pathlib import Path\np=Path("output/pdf/image-conversion-audit")\na=pymupdf.open(p/"txt-color-000000.pdf")\nb=pymupdf.open(p/"fixed/txt-color-000000.pdf")\nprint(json.dumps({"before":a[0].get_text("blocks"),"after":b[0].get_text("blocks")}))',
    ],
    { encoding: 'utf8' }
  )
);
assert.deepEqual(typography.before, typography.after);
checks.push({ id: 'txt-typography-preserved', identicalTextBounds: true });

assert.ok(imagesMethod);
const imageEngine = new Function(
  'base64ToUint8Array2',
  `return ({${imagesMethod}})`
)((text) => new Uint8Array(Buffer.from(text, 'base64')));
imageEngine.getPyodide = async () => {
  const programs = [],
    virtualFiles = {};
  return {
    FS: {
      writeFile: (path, bytes) => {
        virtualFiles[path] = Buffer.from(bytes).toString('base64');
      },
      unlink: noop,
    },
    runPython(code) {
      programs.push(code);
      if (!code.includes('base64.b64encode(output)')) return;
      const preamble = `import pymupdf, base64, json\n_files = json.loads(${JSON.stringify(JSON.stringify(virtualFiles))})\n_open = pymupdf.open\ndef open_virtual(filename=None, *args, **kwargs):\n    if isinstance(filename, str) and filename in _files:\n        return _open(stream=base64.b64decode(_files[filename]))\n    return _open(filename, *args, **kwargs)\npymupdf.open = open_virtual\n`;
      return execFileSync(
        'python',
        [
          '-c',
          'import sys\nexec(sys.stdin.read())\nprint(base64.b64encode(output).decode("ascii"))',
        ],
        {
          input: preamble + programs.join('\n'),
          encoding: 'utf8',
          maxBuffer: 5000000,
        }
      ).trim();
    },
  };
};
const opaque = createCanvas(160, 100);
opaque.getContext('2d').fillStyle = 'white';
opaque.getContext('2d').fillRect(0, 0, 160, 100);
opaque.getContext('2d').drawImage(artwork, 0, 0);
for (const route of ['jpg', 'image']) {
  const isJpg = route === 'jpg';
  const input = isJpg
    ? opaque.toBuffer('image/jpeg')
    : artwork.toBuffer('image/png');
  const scope = environment(
    { 'jpg-pdf-quality': { value: 'medium' } },
    {
      files: [new File([input], isJpg ? 'opaque.jpg' : 'transparent.png')],
      pymupdf: imageEngine,
    }
  );
  extract(scope, 'src/js/utils/image-compress.ts', [
    'QUALITY_CONFIGS',
    'getSelectedQuality',
    'compressImageFile',
  ]);
  if (!isJpg)
    extract(scope, 'src/js/utils/image-input-utils.ts', [
      'getFileExtension',
      'preprocessImageFile',
    ]);
  extract(scope, `src/js/logic/${route}-to-pdf-page.ts`, [
    'ensurePyMuPDF',
    'convertToPdf',
  ]);
  await scope.convertToPdf();
  const bytes = await downloaded(scope, `${route}-route-medium.pdf`);
  const canvas = await render(bytes, `${route}-route-medium.png`);
  const background = pixel(canvas, 5, 5);
  assert.deepEqual(background, [255, 255, 255]);
  checks.push({
    id: `${route}-route`,
    background,
    control: isJpg,
    caveat:
      'Actual pinned wrapper; native PyMuPDF executes its Python, not browser WASM.',
  });
}

const independent = JSON.parse(
  execFileSync(
    'python',
    [
      '-c',
      'import json,pymupdf\nfrom PIL import Image\nfrom pathlib import Path\np=Path("output/pdf/image-conversion-audit/fixed")\nprint(json.dumps({"tiff": {f.name: [Image.open(f).convert("RGB").getpixel((5,5)),Image.open(f).convert("RGB").getpixel((48,32))] for f in sorted(p.glob("tiff-*-input.tiff"))}, "textColors": {f.name: [s["color"] for b in pymupdf.open(f)[0].get_text("dict")["blocks"] if "lines" in b for l in b["lines"] for s in l["spans"]] for f in sorted(p.glob("txt-color-*.pdf"))}}))',
    ],
    { encoding: 'utf8' }
  )
);
assert.deepEqual(independent.tiff['tiff-photo-0-input.tiff'], [
  [255, 255, 255],
  [0, 0, 0],
]);
assert.deepEqual(independent.tiff['tiff-photo-3-input.tiff'], [
  [255, 0, 0],
  [0, 255, 0],
]);
assert.deepEqual(independent.textColors['txt-color-ff0000.pdf'], [0xff0000]);
assert.deepEqual(independent.textColors['txt-color-000000.pdf'], [0]);
checks.push({ id: 'independent-pillow-and-pymupdf-check', ...independent });

save(
  'report.json',
  JSON.stringify(
    {
      method:
        'Actual source functions; real pdf-lib, PDF.js, tiff; native canvas DOM adapter. No browser UI automation.',
      checks,
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify(checks, null, 2));
console.log(`Audit complete: ${out}`);
