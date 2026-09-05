import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Extract Pages","description":"Save a specific range of pages from a PDF as a new document.","frontmatter":{"title":"Extract Pages","description":"Save a specific range of pages from a PDF as a new document.","head":[["link",{"rel":"canonical","href":"https://nguyenthaidinh.github.io/Pagoda/docs/tools/extract-pages"}]]},"headers":[],"relativePath":"tools/extract-pages.md","filePath":"tools/extract-pages.md"}');
const _sfc_main = { name: "tools/extract-pages.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="extract-pages" tabindex="-1">Extract Pages <a class="header-anchor" href="#extract-pages" aria-label="Permalink to &quot;Extract Pages&quot;">​</a></h1><p>Pull a set of pages out of a PDF and save them as a new file. Specify exactly which pages you want using range syntax, and the tool creates a clean PDF containing only those pages.</p><h2 id="how-it-works" tabindex="-1">How It Works <a class="header-anchor" href="#how-it-works" aria-label="Permalink to &quot;How It Works&quot;">​</a></h2><ol><li>Upload a PDF file. The tool displays the file name, size, and total page count.</li><li>Enter the pages you want to extract using range syntax (e.g., <code>1-5</code>, <code>3, 7, 10-12</code>).</li><li>Optionally choose to download each range as a separate PDF in a ZIP archive.</li><li>Click the process button. The extracted pages download as a new PDF (or ZIP).</li></ol><h2 id="features" tabindex="-1">Features <a class="header-anchor" href="#features" aria-label="Permalink to &quot;Features&quot;">​</a></h2><ul><li>Flexible page range syntax: individual pages, ranges, or comma-separated combinations</li><li>Displays total page count after upload for easy reference</li><li>Option to output as a single combined PDF or separate files in a ZIP</li><li>Preserves original page content and formatting</li></ul><h2 id="use-cases" tabindex="-1">Use Cases <a class="header-anchor" href="#use-cases" aria-label="Permalink to &quot;Use Cases&quot;">​</a></h2><ul><li>Pulling the executive summary (first few pages) out of a lengthy report</li><li>Extracting a single chapter from a textbook PDF</li><li>Saving specific pages from a form packet as standalone documents</li><li>Creating a sample document from selected pages of a larger file</li></ul><h2 id="tips" tabindex="-1">Tips <a class="header-anchor" href="#tips" aria-label="Permalink to &quot;Tips&quot;">​</a></h2><ul><li>Page numbers are 1-indexed. Use <code>1</code> for the first page, not <code>0</code>.</li><li>For removing pages instead of extracting them, use <a href="./delete-pages">Delete Pages</a> -- it is the inverse operation.</li><li>If you need visual page selection with thumbnails, use <a href="./split-pdf">Split PDF</a> in Visual Select mode.</li></ul><h2 id="related-tools" tabindex="-1">Related Tools <a class="header-anchor" href="#related-tools" aria-label="Permalink to &quot;Related Tools&quot;">​</a></h2><ul><li><a href="./split-pdf">Split PDF</a></li><li><a href="./delete-pages">Delete Pages</a></li><li><a href="./merge-pdf">Merge PDF</a></li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("tools/extract-pages.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const extractPages = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  extractPages as default
};
