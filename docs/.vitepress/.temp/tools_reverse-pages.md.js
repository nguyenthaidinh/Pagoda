import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Reverse Pages","description":"Flip the page order of one or more PDF files so the last page becomes the first.","frontmatter":{"title":"Reverse Pages","description":"Flip the page order of one or more PDF files so the last page becomes the first.","head":[["link",{"rel":"canonical","href":"https://nguyenthaidinh.github.io/Pagoda/docs/tools/reverse-pages"}]]},"headers":[],"relativePath":"tools/reverse-pages.md","filePath":"tools/reverse-pages.md"}');
const _sfc_main = { name: "tools/reverse-pages.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="reverse-pages" tabindex="-1">Reverse Pages <a class="header-anchor" href="#reverse-pages" aria-label="Permalink to &quot;Reverse Pages&quot;">​</a></h1><p>Reverse the page order of a PDF so the last page becomes the first, the second-to-last becomes the second, and so on. Supports batch processing of multiple files at once.</p><h2 id="how-it-works" tabindex="-1">How It Works <a class="header-anchor" href="#how-it-works" aria-label="Permalink to &quot;How It Works&quot;">​</a></h2><ol><li>Upload one or more PDF files.</li><li>Click the process button.</li><li>Each file is reversed independently. If you uploaded multiple files, the output is a ZIP archive containing all reversed PDFs.</li><li>A single file downloads directly as a reversed PDF.</li></ol><h2 id="features" tabindex="-1">Features <a class="header-anchor" href="#features" aria-label="Permalink to &quot;Features&quot;">​</a></h2><ul><li>Batch processing: reverse multiple PDFs in one operation</li><li>Single-file output for one PDF, ZIP output for multiple</li><li>Per-file removal buttons before processing</li><li>Preserves all page content and formatting</li></ul><h2 id="use-cases" tabindex="-1">Use Cases <a class="header-anchor" href="#use-cases" aria-label="Permalink to &quot;Use Cases&quot;">​</a></h2><ul><li>Fixing a document that was scanned in reverse order</li><li>Preparing a presentation PDF to read from back to front</li><li>Reversing page order for specific printing workflows that feed pages in reverse</li><li>Correcting a document where pages were accidentally assembled backwards</li></ul><h2 id="tips" tabindex="-1">Tips <a class="header-anchor" href="#tips" aria-label="Permalink to &quot;Tips&quot;">​</a></h2><ul><li>Each file in a batch is reversed independently -- the files themselves are not reordered relative to each other.</li><li>For more granular page reordering (not just a full reversal), use <a href="./organize-pdf">Organize &amp; Duplicate</a>.</li></ul><h2 id="related-tools" tabindex="-1">Related Tools <a class="header-anchor" href="#related-tools" aria-label="Permalink to &quot;Related Tools&quot;">​</a></h2><ul><li><a href="./organize-pdf">Organize &amp; Duplicate</a></li><li><a href="./rotate-pdf">Rotate PDF</a></li><li><a href="./pdf-multi-tool">PDF Multi Tool</a></li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("tools/reverse-pages.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const reversePages = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  reversePages as default
};
