import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"PDFs to ZIP","description":"Package multiple PDF files into a single ZIP archive for easy sharing and storage.","frontmatter":{"title":"PDFs to ZIP","description":"Package multiple PDF files into a single ZIP archive for easy sharing and storage.","head":[["link",{"rel":"canonical","href":"https://nguyenthaidinh.github.io/Pagoda/docs/tools/pdf-to-zip"}]]},"headers":[],"relativePath":"tools/pdf-to-zip.md","filePath":"tools/pdf-to-zip.md"}');
const _sfc_main = { name: "tools/pdf-to-zip.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="pdfs-to-zip" tabindex="-1">PDFs to ZIP <a class="header-anchor" href="#pdfs-to-zip" aria-label="Permalink to &quot;PDFs to ZIP&quot;">​</a></h1><p>Bundle multiple PDF files into a single ZIP archive. This is a straightforward packaging tool -- no conversion, compression, or modification of the PDFs themselves.</p><h2 id="how-it-works" tabindex="-1">How It Works <a class="header-anchor" href="#how-it-works" aria-label="Permalink to &quot;How It Works&quot;">​</a></h2><ol><li>Upload multiple PDF files using the drop zone.</li><li>Review the list of files. Remove any you do not want included.</li><li>Click the process button.</li><li>A ZIP archive containing all the uploaded PDFs downloads immediately.</li></ol><h2 id="features" tabindex="-1">Features <a class="header-anchor" href="#features" aria-label="Permalink to &quot;Features&quot;">​</a></h2><ul><li>Accepts any number of PDF files</li><li>Per-file removal before creating the archive</li><li>Preserves original file names inside the ZIP</li><li>No modification of PDF content -- files are packaged as-is</li><li>Displays file name and size for each uploaded PDF</li></ul><h2 id="use-cases" tabindex="-1">Use Cases <a class="header-anchor" href="#use-cases" aria-label="Permalink to &quot;Use Cases&quot;">​</a></h2><ul><li>Bundling a set of invoices or receipts for email attachment</li><li>Packaging project deliverables (multiple PDF reports) for handoff</li><li>Creating a single download for a collection of forms or templates</li><li>Archiving a batch of documents into one compressed file</li></ul><h2 id="tips" tabindex="-1">Tips <a class="header-anchor" href="#tips" aria-label="Permalink to &quot;Tips&quot;">​</a></h2><ul><li>The ZIP file uses the original PDF filenames. If you have files with the same name, rename them before uploading to avoid conflicts.</li><li>This tool does not compress the PDFs themselves. For file size reduction, run them through Compress PDF first, then package with this tool.</li></ul><h2 id="related-tools" tabindex="-1">Related Tools <a class="header-anchor" href="#related-tools" aria-label="Permalink to &quot;Related Tools&quot;">​</a></h2><ul><li><a href="./merge-pdf">Merge PDF</a></li><li><a href="./split-pdf">Split PDF</a></li><li><a href="./compress-pdf">Compress PDF</a></li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("tools/pdf-to-zip.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const pdfToZip = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  pdfToZip as default
};
