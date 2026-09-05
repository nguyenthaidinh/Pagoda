import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Add Blank Page","description":"Insert one or more blank pages at any position in a PDF document.","frontmatter":{"title":"Add Blank Page","description":"Insert one or more blank pages at any position in a PDF document.","head":[["link",{"rel":"canonical","href":"https://nguyenthaidinh.github.io/Pagoda/docs/tools/add-blank-page"}]]},"headers":[],"relativePath":"tools/add-blank-page.md","filePath":"tools/add-blank-page.md"}');
const _sfc_main = { name: "tools/add-blank-page.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="add-blank-page" tabindex="-1">Add Blank Page <a class="header-anchor" href="#add-blank-page" aria-label="Permalink to &quot;Add Blank Page&quot;">​</a></h1><p>Insert empty pages into a PDF at a position you specify. You control where the blank pages go and how many to add.</p><h2 id="how-it-works" tabindex="-1">How It Works <a class="header-anchor" href="#how-it-works" aria-label="Permalink to &quot;How It Works&quot;">​</a></h2><ol><li>Upload a PDF file. The tool displays the page count.</li><li>Enter the <strong>position</strong> where blank pages should be inserted. Use <code>0</code> to insert at the very beginning, or the total page count to append at the end.</li><li>Enter the <strong>number</strong> of blank pages to add (default is 1).</li><li>Click the process button. The modified PDF downloads with the blank pages inserted.</li></ol><h2 id="features" tabindex="-1">Features <a class="header-anchor" href="#features" aria-label="Permalink to &quot;Features&quot;">​</a></h2><ul><li>Insert at any position: beginning, middle, or end of the document</li><li>Add multiple blank pages in one operation</li><li>Position hint updates dynamically based on the uploaded PDF&#39;s page count</li><li>Standard A4-sized blank pages</li></ul><h2 id="use-cases" tabindex="-1">Use Cases <a class="header-anchor" href="#use-cases" aria-label="Permalink to &quot;Use Cases&quot;">​</a></h2><ul><li>Adding a blank separator page between sections of a compiled document</li><li>Inserting blank pages for double-sided printing alignment</li><li>Adding space for handwritten notes in a printed study guide</li><li>Padding a document to meet a minimum page count requirement</li></ul><h2 id="tips" tabindex="-1">Tips <a class="header-anchor" href="#tips" aria-label="Permalink to &quot;Tips&quot;">​</a></h2><ul><li>Position <code>0</code> inserts before the first page. Position equal to the total page count appends after the last page.</li><li>If you need to insert content (not just blanks) at a specific position, use <a href="./pdf-multi-tool">PDF Multi Tool</a> to insert another PDF after a given page.</li></ul><h2 id="related-tools" tabindex="-1">Related Tools <a class="header-anchor" href="#related-tools" aria-label="Permalink to &quot;Related Tools&quot;">​</a></h2><ul><li><a href="./organize-pdf">Organize &amp; Duplicate</a></li><li><a href="./pdf-multi-tool">PDF Multi Tool</a></li><li><a href="./merge-pdf">Merge PDF</a></li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("tools/add-blank-page.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const addBlankPage = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  addBlankPage as default
};
