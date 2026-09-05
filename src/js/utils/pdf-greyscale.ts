import { loadPyMuPDF } from './pymupdf-loader.js';

interface RecolorDocument {
  docVar: string;
  runPython(code: string): unknown;
  save(options: {
    garbage: number;
    deflate: boolean;
    clean: boolean;
  }): Uint8Array;
  close(): void;
}

/** Use MuPDF's object color conversion so text, links and widgets remain live. */
export async function convertPdfToGreyscale(file: File): Promise<Uint8Array> {
  const engine = await loadPyMuPDF();
  const doc = (await engine.open(file)) as unknown as RecolorDocument;
  try {
    // These members belong to the bundled PyMuPDFDocument wrapper. Fail clearly
    // on an incompatible externally configured wrapper; never rasterize silently.
    if (typeof doc.runPython !== 'function' || !/^_doc\d+$/.test(doc.docVar)) {
      throw new Error(
        'The configured PDF engine does not support object recoloring'
      );
    }
    // MuPDF's page recoloring omits annotation appearance streams. Process those
    // as temporary pages as well, then restore their streams without flattening.
    doc.runPython(`
def _pagoda_recolor(doc):
    appearances = {}
    def collect(kind, value, fallback_resources):
        if kind == 'dict':
            xref = doc.get_new_xref()
            doc.update_object(xref, value)
        elif kind == 'xref':
            xref = int(value.split()[0])
            if doc.xref_is_stream(xref):
                appearances.setdefault(xref, fallback_resources)
                return
        else:
            return
        for key in doc.xref_get_keys(xref):
            collect(*doc.xref_get_key(xref, key), fallback_resources)

    for page in doc:
        parent = page.xref
        resources = ('null', 'null')
        while parent:
            resources = doc.xref_get_key(parent, 'Resources')
            if resources[0] != 'null':
                break
            kind, value = doc.xref_get_key(parent, 'Parent')
            parent = int(value.split()[0]) if kind == 'xref' else 0
        for xref, _, _ in page.annot_xrefs():
            collect(*doc.xref_get_key(xref, 'AP'), resources)

    doc.recolor(components=1)
    for xref, fallback in appearances.items():
        page = doc.new_page()
        try:
            bbox = doc.xref_get_key(xref, 'BBox')
            if bbox[0] != 'null':
                doc.xref_set_key(page.xref, 'MediaBox', bbox[1])
            resources = doc.xref_get_key(xref, 'Resources')
            if resources[0] == 'null':
                resources = fallback
            doc.xref_set_key(page.xref, 'Resources', resources[1])
            doc.xref_set_key(page.xref, 'Contents', str(xref) + ' 0 R')
            page = doc.reload_page(page)
            page.recolor(components=1)
            data = b'\\n'.join(doc.xref_stream(ref) for ref in page.get_contents())
            doc.update_stream(xref, data)
            doc.xref_set_key(xref, 'Resources', doc.xref_get_key(page.xref, 'Resources')[1])
        finally:
            doc.delete_page(doc.page_count - 1)

try:
    _pagoda_recolor(${doc.docVar})
finally:
    del _pagoda_recolor
`);
    return doc.save({ garbage: 1, deflate: true, clean: false });
  } finally {
    doc.close();
  }
}
