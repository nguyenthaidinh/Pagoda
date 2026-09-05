// Review-only reproducer. Production functions are extracted unchanged by AST.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as PDF from 'pdf-lib';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import PostalMime from 'postal-mime';
import MsgModule from '@kenjiuno/msgreader';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import Vips from 'wasm-vips';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

const fixed = process.argv.includes('--fixed');
const auditRoot = resolve('output/pdf/export-algorithm-audit');
const out = fixed ? resolve(auditRoot, 'fixed') : auditRoot;
mkdirSync(out, { recursive: true });
const save = (name, bytes) => writeFileSync(resolve(out, name), bytes);
const findings = [], controls = [], limitations = [];
const noop = () => {};
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const MsgReader = MsgModule.default ?? MsgModule;
const DOMPurify = createDOMPurify(new JSDOM('').window);
const vips = await Vips({ dynamicLibraries: [] });
vips.Cache.max(0);

// JSZip's browser FileReader input adapter is absent in Node; bytes are unchanged.
class NodeZip extends JSZip {
  file(name, data, options) {
    if (arguments.length === 1) return super.file(name);
    return super.file(name, data instanceof Blob ? data.arrayBuffer() : data, options);
  }
}
function extract(scope, path, names, nested = false) {
  const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const pieces = names.map((name) => {
    const found = [];
    const visit = (node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) found.push(node.getText(ast));
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
        found.push(`const ${node.getText(ast)};`);
      if (nested) ts.forEachChild(node, visit);
    };
    if (nested) visit(ast);
    else for (const node of ast.statements) {
      visit(node);
      if (ts.isVariableStatement(node)) node.declarationList.declarations.forEach(visit);
    }
    assert.equal(found.length, 1, `${path}:${name}: ${found.length} matches`);
    return found[0];
  });
  const code = ts.transpileModule(pieces.join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('scope', `with(scope) { ${code}\nObject.assign(scope,{${names.join(',')}}); }`)(scope);
}
async function openPdf(bytes) {
  return pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true,
    standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/' }).promise;
}
function scopeFor(values = {}, extra = {}) {
  const downloads = [], alerts = [], readers = [];
  return {
    ...PDF, exports: {}, JSZip: NodeZip, XLSX,
    require: (name) => { assert.equal(name, 'jszip'); return { default: NodeZip }; },
    document: { createElement: () => createCanvas(1, 1), getElementById: (id) => values[id] ?? null },
    showLoader: noop, hideLoader: noop, showAlert: (...args) => alerts.push(args), resetState: noop,
    t: (key) => key, pdfExportText: (key) => key,
    getCleanPdfFilename: (name) => name.replace(/\.pdf$/i, ''),
    downloadFile: (blob, name) => downloads.push({ blob, name }),
    async loadPdfWithPasswordPrompt(file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await openPdf(bytes); readers.push(pdf);
      return { pdf, bytes, file };
    },
    downloads, alerts, readers, ...extra,
  };
}
async function finish(scope, name) {
  assert.equal(scope.downloads.length, 1, JSON.stringify(scope.alerts));
  const bytes = new Uint8Array(await scope.downloads[0].blob.arrayBuffer());
  save(name, bytes);
  for (const reader of scope.readers) await reader.destroy();
  return bytes;
}
function py(code, globals = {}) {
  return execFileSync('python', ['-c',
    'import sys,json,ast,pymupdf,base64,contextlib\np=json.load(sys.stdin)\ng={"pymupdf":pymupdf,"base64":base64,**p["globals"]}\nm=ast.parse(p["code"])\nlast=m.body.pop()\nwith contextlib.redirect_stdout(sys.stderr):\n exec(compile(m,"audit","exec"),g)\n if isinstance(last,ast.Expr): result=eval(compile(ast.Expression(last.value),"audit","eval"),g)\n else:\n  exec(compile(ast.Module(body=[last],type_ignores=[]),"audit","exec"),g)\n  result=""\nprint(result)'],
    { input: JSON.stringify({ code, globals }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20000000, timeout: 60000 }).trim();
}
const engineSource = execFileSync('tar', ['-xOf', 'bentopdf-airgap-bundle/bentopdf-pymupdf-wasm-0.11.16.tgz', 'package/dist/index.js'],
  { encoding: 'utf8', maxBuffer: 5000000 });
const ast = ts.createSourceFile('engine.js', engineSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function engineMethod(name) {
  let source;
  const visit = (node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(ast) === name) source = node.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(source, name);
  return new Function('base64ToUint8Array2', 'uint8ArrayToBase642', `return ({${source}})`)(
    (s) => new Uint8Array(Buffer.from(s, 'base64')), (b) => Buffer.from(b).toString('base64'))[name];
}
const htmlEngine = { htmlToPdf: engineMethod('htmlToPdf'), async getPyodide() {
  const globals = {};
  return { globals: { set: (key, value) => { globals[key] = value; }, delete: (key) => delete globals[key] },
    runPython: (code) => py(code, globals) };
} };
let wasmEngine;
if (fixed) {
  const engineRoot = resolve('tmp/export-pyodide');
  const assets = resolve('tmp/export-pyodide/package/assets');
  if (!existsSync(resolve(assets, 'pymupdf-1.26.3-cp313-none-pyodide_2025_0_wasm32.whl'))) {
    mkdirSync(engineRoot, { recursive: true });
    execFileSync('tar', ['-xf', 'bentopdf-airgap-bundle/bentopdf-pymupdf-wasm-0.11.16.tgz',
      '-C', engineRoot, 'package/assets', 'package/dist/index.js']);
  }
  // The browser distribution mixes ESM and a CJS Emscripten loader. Give the
  // Node-only audit copies the proper module extensions without changing assets.
  copyFileSync(resolve(assets, 'pyodide.js'), resolve(assets, 'pyodide.mjs'));
  writeFileSync(resolve(assets, 'package.json'), JSON.stringify({ type: 'commonjs' }));
  const { loadPyodide } = await import(pathToFileURL(resolve(assets, 'pyodide.mjs')));
  const runtime = await loadPyodide({ indexURL: assets });
  await runtime.loadPackage(resolve(assets, 'pymupdf-1.26.3-cp313-none-pyodide_2025_0_wasm32.whl').replaceAll('\\', '/'));
  runtime.runPython('import pymupdf');
  const { PyMuPDF } = await import(pathToFileURL(resolve('tmp/export-pyodide/package/dist/index.js')));
  wasmEngine = new PyMuPDF({ assetPath: assets });
  wasmEngine.pyodide = runtime;
  controls.push({ tool: 'PyMuPDF runtime', version: runtime.runPython('pymupdf.VersionBind'), wasm: true });
}
const emailScope = { exports: {}, PostalMime, MsgReader, DOMPurify };
extract(emailScope, 'src/js/utils/helpers.ts', ['formatBytes', 'escapeHtml', 'uint8ArrayToBase64', 'sanitizeEmailHtml', 'formatRawDate']);
extract(emailScope, 'src/js/logic/email-to-pdf.ts', ['formatAddress', 'parseEmlFile', 'parseMsgFile', 'processInlineImages', 'renderEmailToHtml', 'parseEmailFile']);

function eml(subject, body, attachment = false) {
  const headers = ['From: sender@example.test', 'To: reader@example.test', `Subject: ${subject}`,
    'Date: Mon, 1 Jun 2026 10:00:00 +0000', 'MIME-Version: 1.0'];
  if (!attachment) return [...headers, 'Content-Type: text/html; charset=utf-8', '', body].join('\r\n');
  return [...headers, 'Content-Type: multipart/mixed; boundary="audit-boundary"', '',
    '--audit-boundary', 'Content-Type: text/html; charset=utf-8', '', body,
    '--audit-boundary', 'Content-Type: text/plain; name="note.txt"',
    'Content-Disposition: attachment; filename="note.txt"', 'Content-Transfer-Encoding: base64', '',
    Buffer.from('ATTACHMENT MUST FOLLOW THE OPTION').toString('base64'), '--audit-boundary--', ''].join('\r\n');
}
async function convertEmails(files, includeAttachments = true) {
  const scope = scopeFor({ 'include-attachments': { checked: includeAttachments } },
    { state: { files }, TOOL_NAME: 'Email', ...emailScope, loadPyMuPDF: async () => wasmEngine ?? htmlEngine });
  extract(scope, 'src/js/logic/email-to-pdf-page.ts', ['convertToPdf'], true);
  await scope.convertToPdf();
  return scope;
}

// Real MSG container: the reader returns attachment metadata separately from bytes.
const cfb = XLSX.CFB.utils.cfb_new();
const add = (path, bytes) => XLSX.CFB.utils.cfb_add(cfb, path, bytes);
add('__properties_version1.0', Buffer.alloc(32));
add('__substg1.0_0037001F', Buffer.from('MSG attachment audit\0', 'utf16le'));
add('__substg1.0_1000001F', Buffer.from('Body with attachment\0', 'utf16le'));
const attachmentFolder = '__attach_version1.0_#00000000/';
add(attachmentFolder + '__properties_version1.0', Buffer.alloc(8));
add(attachmentFolder + '__substg1.0_3707001F', Buffer.from('note.txt\0', 'utf16le'));
add(attachmentFolder + '__substg1.0_370E001F', Buffer.from('text/plain\0', 'utf16le'));
add(attachmentFolder + '__substg1.0_37010102', Buffer.from('ACTUAL MSG ATTACHMENT'));
const msgBytes = XLSX.CFB.write(cfb, { type: 'buffer' });
save('attachment-input.msg', msgBytes);
const msg = new File([msgBytes], 'attachment.msg');
const reader = new MsgReader(await msg.arrayBuffer());
const nativeMsg = reader.getFileData();
assert.equal(nativeMsg.attachments.length, 1);
const actualAttachment = reader.getAttachment(0);
assert.equal(Buffer.from(actualAttachment.content).toString(), 'ACTUAL MSG ATTACHMENT');
const parsedMsg = await emailScope.parseMsgFile(msg);
if (fixed) assert.deepEqual(parsedMsg.attachments[0].content, actualAttachment.content);
else assert.equal(parsedMsg.attachments[0].content, undefined);
const msgConversion = await convertEmails([msg]);
await finish(msgConversion, 'attachment-msg-output.pdf');
const msgEmbeddedFiles = JSON.parse(py(`import json\nd=pymupdf.open(${JSON.stringify(resolve(out, 'attachment-msg-output.pdf'))})\njson.dumps(d.embfile_names())`));
assert.deepEqual(msgEmbeddedFiles, fixed ? ['note.txt'] : []);
findings.push({ id: 'msg-attachment-loss', readerBytes: actualAttachment.content.length,
  appBytes: parsedMsg.attachments[0].size, appContentMissing: !parsedMsg.attachments[0].content, outputEmbeddedFiles: msgEmbeddedFiles });

const attachedEml = eml('Attachment checkbox', '<p>EMAIL BODY</p>', true);
save('attachment-input.eml', attachedEml);
for (const include of [true, false]) {
  const scope = await convertEmails([new File([attachedEml], 'attachment.eml')], include);
  await finish(scope, `attachment-option-${include}.pdf`);
}
const attachmentResults = JSON.parse(py(`import json\nfrom pathlib import Path\np=Path(${JSON.stringify(out)})\njson.dumps({str(v):pymupdf.open(p/('attachment-option-'+str(v).lower()+'.pdf')).embfile_names() for v in [True,False]})`));
assert.deepEqual(attachmentResults.True, ['note.txt']); assert.deepEqual(attachmentResults.False, ['note.txt']);
controls.push({ tool: 'Email attachment list option', ...attachmentResults,
  note: 'The UI explicitly toggles the attachment list, not embedding. Retaining embedded files is not classified as a defect.' });

const firstEmail = eml('FIRST MESSAGE', '<p>FIRST BODY</p>');
const secondEmail = eml('SECOND MESSAGE', '<p>SECOND BODY</p>');
save('duplicate-first.eml', firstEmail);
save('duplicate-second.eml', secondEmail);
const duplicates = await convertEmails([
  new File([firstEmail], 'same.eml'),
  new File([secondEmail], 'same.eml'),
]);
const duplicateZip = await JSZip.loadAsync(await finish(duplicates, 'duplicate-emails.zip'));
assert.deepEqual(Object.keys(duplicateZip.files), fixed ? ['same.pdf', 'same-1.pdf'] : ['same.pdf']);
save('duplicate-surviving-message.pdf', await duplicateZip.file('same.pdf').async('uint8array'));
findings.push({ id: 'email-duplicate-overwrite', inputs: 2, pdfsInArchive: Object.keys(duplicateZip.files).length, alert: duplicates.alerts.at(-1)?.[1] });

const brokenBatch = await convertEmails([
  new File([eml('VALID MESSAGE', '<p>VALID BODY</p>')], 'valid.eml'),
  new File(['not an OLE message'], 'broken.msg'),
]);
const partialZip = await JSZip.loadAsync(await finish(brokenBatch, 'partial-emails.zip'));
limitations.push({ tool: 'Email invalid-input probe', inputs: 2,
  pdfsInArchive: Object.keys(partialZip.files).length,
  note: 'The malformed MSG was accepted as an empty message; this did not reproduce the suspected caught-error/partial-success path, so that suspicion is not reported as a confirmed defect.' });

const longBody = Array.from({ length: 1700 }, (_, i) => `<div>Row ${i}: ordinary email content requiring complete preservation.</div>`).join('') + '<div>FINAL CONFIRMATION 7391</div>';
const longEml = eml('Long email', longBody);
save('long-email-input.eml', longEml);
const longParsed = await emailScope.parseEmailFile(new File([longEml], 'long.eml'));
const longHtml = emailScope.renderEmailToHtml(longParsed);
assert.ok(longParsed.htmlBody.includes('FINAL CONFIRMATION 7391'));
assert.equal(longHtml.includes('FINAL CONFIRMATION 7391'), fixed);
save('long-email-rendered.html', longHtml);
const longConversion = await convertEmails([new File([longEml], 'long.eml')]);
await finish(longConversion, 'long-email-output.pdf');
const longOutputCheck = JSON.parse(py(`import json\nd=pymupdf.open(${JSON.stringify(resolve(out, 'long-email-output.pdf'))})\ntext=''.join(p.get_text() for p in d)\njson.dumps({'hasStart':'Row 0:' in text,'hasEnd':'FINAL CONFIRMATION 7391' in text})`));
assert.equal(longOutputCheck.hasStart, true);
assert.equal(longOutputCheck.hasEnd, fixed);
findings.push({ id: 'email-body-truncated', inputHtmlLength: longParsed.htmlBody.length,
  endingPresentBefore: true, endingPresentInRenderer: fixed, pdfText: longOutputCheck, alertType: longConversion.alerts.at(-1)?.[2] });

// PDF fixtures for rendering, archive ordering, and document-structure checks.
const doc = await PDF.PDFDocument.create();
doc.setTitle('KEEP TITLE');
const page = doc.addPage([240, 160]);
page.drawText('SEARCHABLE RED TEXT', { x: 15, y: 130, size: 12, color: PDF.rgb(1, 0, 0) });
page.drawRectangle({ x: 20, y: 20, width: 35, height: 35, color: PDF.rgb(0, 1, 0) });
const field = doc.getForm().createTextField('customer');
field.setText('EDIT ME'); field.addToPage(page, { x: 70, y: 30, width: 140, height: 25,
  ...(fixed ? { textColor: PDF.rgb(0, 0, 1), backgroundColor: PDF.rgb(1, 0, 0), borderColor: PDF.rgb(0, 1, 0) } : {}) });
page.node.addAnnot(doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [15, 125, 220, 145],
  A: { S: 'URI', URI: PDF.PDFString.of('https://example.test/') } })));
const inputBytes = await doc.save(); save('render-input.pdf', inputBytes);
const inputFile = new File([inputBytes], 'render.pdf');
const grayScope = scopeFor({}, { files: [inputFile] });
if (fixed) {
  grayScope.loadPyMuPDF = async () => wasmEngine;
  extract(grayScope, 'src/js/utils/pdf-greyscale.ts', ['convertPdfToGreyscale']);
} else extract(grayScope, 'src/js/utils/image-effects.ts', ['applyGreyscale']);
extract(grayScope, 'src/js/logic/pdf-to-greyscale-page.ts', ['convert']);
await grayScope.convert();
const grayBytes = await finish(grayScope, 'greyscale-output.pdf');
const grayDoc = await PDF.PDFDocument.load(grayBytes);
const grayReader = await openPdf(grayBytes);
const grayText = (await (await grayReader.getPage(1)).getTextContent()).items.filter((x) => 'str' in x).map((x) => x.str).join('');
if (fixed) assert.ok(grayText.includes('SEARCHABLE RED TEXT'));
else assert.equal(grayText, '');
assert.equal(grayDoc.getForm().getFields().length, fixed ? 1 : 0);
assert.equal(grayDoc.getPage(0).node.Annots()?.size() ?? 0, fixed ? 2 : 0);
findings.push({ id: 'greyscale-rasterizes-document', beforeFields: 1, afterFields: grayDoc.getForm().getFields().length, beforeSearchableText: true,
  afterText: grayText, afterAnnotations: grayDoc.getPage(0).node.Annots()?.size() ?? 0,
  sizeRetained: grayDoc.getPage(0).getSize() });
await grayReader.destroy();

for (const format of ['jpg', 'png', 'webp', ...(fixed ? ['bmp'] : [])]) {
  const scope = scopeFor({}, { files: [inputFile] });
  if (format === 'bmp') extract(scope, 'src/js/utils/bmp-encoder.ts', ['encodeBmp']);
  extract(scope, `src/js/logic/pdf-to-${format}-page.ts`, ['renderPage', 'convert']);
  await scope.convert();
  await finish(scope, `render-output.${format}`);
  controls.push({ tool: `PDF to ${format}`, outputType: scope.downloads[0].blob.type, produced: true });
}

const mixed = await PDF.PDFDocument.create();
mixed.addPage([100, 100]).drawRectangle({ x: 0, y: 0, width: 100, height: 100, color: PDF.rgb(1, 0, 0) });
mixed.addPage([100, 200]).drawRectangle({ x: 0, y: 0, width: 100, height: 200, color: PDF.rgb(0, 1, 0) });
const mixedBytes = await mixed.save(); save('mixed-size-input.pdf', mixedBytes);
for (const multiPage of [false, true]) {
  const scope = scopeFor({}, { files: [new File([mixedBytes], 'mixed.pdf')], getVips: async () => vips,
    getOptions: () => ({ dpi: 72, compression: 'lzw', colorMode: 'rgb', multiPage }) });
  if (fixed) extract(scope, 'src/js/utils/tiff-pages.ts', ['joinTiffPages']);
  extract(scope, 'src/js/logic/pdf-to-tiff-page.ts', ['renderPageToRgba', 'encodePageToTiff', 'convert']);
  await scope.convert();
  const bytes = await finish(scope, multiPage ? 'mixed-multipage.tiff' : 'mixed-separate.zip');
  if (!multiPage) {
    const zip = await JSZip.loadAsync(bytes);
    for (const [name, entry] of Object.entries(zip.files)) save(`separate-${name}`, await entry.async('uint8array'));
  }
}
const tiffResults = JSON.parse(py(`from PIL import Image\nimport json\nfrom pathlib import Path\np=Path(${JSON.stringify(out)})\nresult={}\nfor name in ['mixed-multipage.tiff','separate-page_1.tiff','separate-page_2.tiff']:\n im=Image.open(p/name)\n frames=[]\n for i in range(im.n_frames):\n  im.seek(i)\n  frames.append({'size':im.size,'pixel':im.convert('RGB').getpixel((50,50))})\n result[name]=frames\njson.dumps(result)`));
findings.push({ id: 'tiff-mixed-page-height', expectedPages: 2, ...tiffResults });
if (fixed) assert.deepEqual(tiffResults['mixed-multipage.tiff'], [
  tiffResults['separate-page_1.tiff'][0], tiffResults['separate-page_2.tiff'][0],
]);
else assert.notEqual(tiffResults['mixed-multipage.tiff'].length, 2);
assert.deepEqual(tiffResults['separate-page_1.tiff'][0].size, [100, 100]);
assert.deepEqual(tiffResults['separate-page_2.tiff'][0].size, [100, 200]);
if (fixed) {
  const codecScope = scopeFor({});
  extract(codecScope, 'src/js/utils/tiff-pages.ts', ['joinTiffPages']);
  extract(codecScope, 'src/js/logic/pdf-to-tiff-page.ts', ['encodePageToTiff']);
  for (const compression of ['lzw', 'deflate', 'ccittfax4', 'jpeg', 'packbits', 'none']) {
    const encoded = [[129, 270], [91, 315]].map(([width, height], index) => {
      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const value = (Math.floor(y / 30) + Math.floor(x / 30) + index) % 2 ? 255 : 0;
        rgba.set([value, value, value, 255], (y * width + x) * 4);
      }
      return codecScope.encodePageToTiff(vips, rgba, width, height,
        { dpi: 150, compression, colorMode: compression === 'ccittfax4' ? 'bw' : 'rgb', multiPage: true });
    });
    save(`codec-${compression}.tiff`, codecScope.joinTiffPages(encoded));
  }
  const codecResults = JSON.parse(py(`from PIL import Image\nfrom pathlib import Path\nimport json\np=Path(${JSON.stringify(out)})\nresult={}\nfor name in ['lzw','deflate','ccittfax4','jpeg','packbits','none']:\n im=Image.open(p/('codec-'+name+'.tiff'))\n frames=[]\n for i in range(im.n_frames):\n  im.seek(i)\n  rgb=im.convert('RGB')\n  frames.append({'size':im.size,'dpi':[float(v) for v in im.info['dpi']],'compression':im.tag_v2[259],'top':rgb.getpixel((5,5))[0],'bottom':rgb.getpixel((5,im.height-5))[0]})\n result[name]=frames\njson.dumps(result)`));
  for (const frames of Object.values(codecResults)) {
    assert.deepEqual(frames.map(f => f.size), [[129, 270], [91, 315]]);
    assert.deepEqual(frames.map(f => f.dpi), [[150, 150], [150, 150]]);
    assert.ok(frames[0].top < 10 && frames[0].bottom < 10);
    assert.ok(frames[1].top > 245 && frames[1].bottom > 245);
  }
  controls.push({ tool: 'TIFF compression modes', codecResults });
}

const cbzScope = scopeFor({ 'cbz-metadata': { checked: false }, 'cbz-format': { value: 'png' }, 'cbz-scale': { value: '1' } },
  { files: [new File([mixedBytes], 'mixed.pdf')] });
extract(cbzScope, 'src/js/logic/pdf-to-cbz-page.ts', ['getOptions', 'getMimeType', 'getExtension', 'renderPage', 'convert']);
await cbzScope.convert();
const cbz = await JSZip.loadAsync(await finish(cbzScope, 'mixed-output.cbz'));
assert.deepEqual(Object.keys(cbz.files), ['1.png', '2.png']);
controls.push({ tool: 'PDF to CBZ', archiveEntries: Object.keys(cbz.files) });

const bmpProof = new JSDOM(readFileSync(resolve(auditRoot, 'edge-bmp-output.txt'), 'utf8'));
const bmpResult = JSON.parse(bmpProof.window.document.getElementById('result').textContent);
assert.equal(bmpResult.actual, 'image/png');
if (fixed) {
  const bytes = readFileSync(resolve(out, 'render-output.bmp'));
  assert.equal(bytes.subarray(0, 2).toString(), 'BM');
  const decoded = JSON.parse(py(`from PIL import Image\nimport json\nim=Image.open(${JSON.stringify(resolve(out, 'render-output.bmp'))})\njson.dumps({'format':im.format,'size':im.size})`));
  assert.equal(decoded.format, 'BMP');
  assert.deepEqual(decoded.size, [480, 320]);
  findings.push({ id: 'bmp-is-png', fixed: true, ...decoded });
} else findings.push({ id: 'bmp-is-png', ...bmpResult, sourceCall: 'pdf-to-bmp-page.ts:161 canvas.toBlob(image/bmp)' });

// Real PSD with an uncompressed RGB composite, independently readable by Pillow.
const psd = Buffer.alloc(40 + 3 * 16 * 16);
psd.write('8BPS'); psd.writeUInt16BE(1, 4); psd.writeUInt16BE(3, 12);
psd.writeUInt32BE(16, 14); psd.writeUInt32BE(16, 18); psd.writeUInt16BE(8, 22); psd.writeUInt16BE(3, 24);
psd.fill(255, 40, 40 + 256); save('composite-input.psd', psd);
const psdResult = JSON.parse(py(`from PIL import Image\nimport json\np=${JSON.stringify(resolve(out, 'composite-input.psd'))}\nresult={'pillowSize':Image.open(p).size}\ntry:\n d=pymupdf.open(p,filetype='psd')\n result['pdfBytes']=len(d.convert_to_pdf())\nexcept Exception as e:\n result['error']=str(e)\njson.dumps(result)`));
limitations.push({ tool: 'PSD', nativeProbe: psdResult, note: 'Native PyMuPDF differs from browser WASM; do not classify this probe alone as a confirmed browser defect.' });

// Execute pinned page methods using the same real PDF bytes in native PyMuPDF.
const pageEngine = {
  async open(file) {
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const prefix = `doc=pymupdf.open(stream=base64.b64decode(${JSON.stringify(base64)}),filetype='pdf')\n`;
    const pageCount = Number(py(prefix + 'doc.page_count'));
    return { pageCount, close: noop, getPage(pageNumber) {
      return { docVar: 'doc', pageNumber, runPython: (code) => py(prefix + code),
        findTables: engineMethod('findTables'), toSvg: engineMethod('toSvg') };
    } };
  },
};
const tableDoc = await PDF.PDFDocument.create();
const tablePage = tableDoc.addPage([400, 300]);
const tableRows = [['Item', 'Amount'], ['A, B', '12.50'], ['He said "OK"', '007']];
for (let x = 40; x <= 360; x += 160) tablePage.drawLine({ start: { x, y: 100 }, end: { x, y: 250 }, thickness: 1 });
for (let y = 100; y <= 250; y += 50) tablePage.drawLine({ start: { x: 40, y }, end: { x: 360, y }, thickness: 1 });
tableRows.forEach((row, r) => row.forEach((text, c) => tablePage.drawText(text, { x: 50 + c * 160, y: 220 - r * 50, size: 12 })));
const tableBytes = await tableDoc.save(); save('table-input.pdf', tableBytes);
for (const format of ['csv', 'excel']) {
  const scope = scopeFor({}, { file: new File([tableBytes], 'table.pdf'), loadPyMuPDF: async () => pageEngine });
  extract(scope, `src/js/logic/pdf-to-${format}-page.ts`, format === 'csv' ? ['tableToCsv', 'convert'] : ['convert']);
  await scope.convert();
  const bytes = await finish(scope, format === 'csv' ? 'table-output.csv' : 'table-output.xlsx');
  if (format === 'excel') {
    const workbook = XLSX.read(bytes, { type: 'array' });
    const actual = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    assert.deepEqual(actual, tableRows);
    controls.push({ tool: 'PDF to Excel', rows: actual, nativeEngineSubstitute: true });
  } else {
    const actual = Buffer.from(bytes).toString();
    assert.equal(actual, 'Item,Amount\n"A, B",12.50\n"He said ""OK""",007');
    controls.push({ tool: 'PDF to CSV', csv: actual, nativeEngineSubstitute: true });
  }
}
const svgScope = scopeFor({}, { files: [new File([mixedBytes], 'mixed.pdf')], pymupdf: pageEngine,
  isPyMuPDFAvailable: () => true, batchDecryptIfNeeded: async (files) => files });
extract(svgScope, 'src/js/logic/pdf-to-svg-page.ts', ['convert']);
await svgScope.convert();
const svgZip = await JSZip.loadAsync(await finish(svgScope, 'mixed-svg.zip'));
assert.deepEqual(Object.keys(svgZip.files), ['page_1.svg', 'page_2.svg']);
for (const [name, entry] of Object.entries(svgZip.files)) {
  const svg = await entry.async('string'); save(name, svg);
  const parsed = new JSDOM(svg, { contentType: 'image/svg+xml' });
  assert.equal(parsed.window.document.documentElement.tagName, 'svg');
  assert.equal(parsed.window.document.documentElement.getAttribute('width'), '100');
  assert.equal(parsed.window.document.documentElement.getAttribute('height'), name === 'page_1.svg' ? '100' : '200');
}
controls.push({ tool: 'PDF to SVG', archiveEntries: Object.keys(svgZip.files), originalPageSizes: true, nativeEngineSubstitute: true });
limitations.push({ tool: 'VSD/VSDX', sourceReviewOnly: true,
  note: 'Local LibreOffice assets exist and the route forwards the extension and bytes. No real Visio document was executed through the browser worker; unsupported type declarations alone are not enough to establish a runtime failure.' });

// Render evidence with an independent reader; do not infer preservation from appearance.
py(`from PIL import Image\nfrom pathlib import Path\np=Path(${JSON.stringify(out)})\nfor name in ['render-input.pdf','greyscale-output.pdf','attachment-msg-output.pdf','attachment-option-false.pdf']:\n d=pymupdf.open(p/name)\n d[0].get_pixmap(matrix=pymupdf.Matrix(2,2)).save(str(p/(name+'.png')))\nim=Image.open(p/'mixed-multipage.tiff')\nfor i in range(im.n_frames):\n im.seek(i)\n im.convert('RGB').save(p/('mixed-frame-'+str(i+1)+'.png'))\nprint('rendered')`);
if (fixed) {
  const grayChecks = JSON.parse(py(`from PIL import Image\nimport json\nfrom pathlib import Path\np=Path(${JSON.stringify(out)})\nd=pymupdf.open(p/'greyscale-output.pdf')\nim=Image.open(p/'greyscale-output.pdf.png').convert('RGB')\njson.dumps({'coloredPixels':sum(max(c)-min(c)>3 for c in im.getdata()),'links':[{'uri':link.get('uri'),'rect':list(link['from'])} for link in d[0].get_links()],'fieldValue':next(d[0].widgets()).field_value,'title':d.metadata['title'],'pageCount':d.page_count})`));
  assert.equal(grayChecks.coloredPixels, 0);
  assert.equal(grayChecks.links.length, 1);
  assert.equal(grayChecks.links[0].uri, 'https://example.test/');
  assert.equal(grayChecks.fieldValue, 'EDIT ME');
  assert.equal(grayChecks.title, 'KEEP TITLE');
  assert.equal(grayChecks.pageCount, 1);
  controls.push({ tool: 'Greyscale visual and interactive structure', ...grayChecks });
}

const result = { fixed, method: fixed ? 'Actual TS functions and codecs; email and greyscale use bundled PyMuPDF 1.26.3 WASM in Node. CSV/Excel/SVG controls use native PyMuPDF.' : 'Actual TS functions, real parsers/codecs; native PyMuPDF executes pinned HTML wrapper; Edge probe only verifies Canvas BMP support.', findings, controls, limitations };
save('report.json', JSON.stringify(result, null, 2) + '\n');
vips.shutdown();
console.log(JSON.stringify(result, null, 2));
