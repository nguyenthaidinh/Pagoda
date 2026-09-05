import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"","description":"","frontmatter":{"layout":"home","hero":{"name":"PagodaPDF","text":"Open-source PDF tools in your browser","tagline":"Process documents locally with a browser-based toolkit derived from BentoPDF.","actions":[{"theme":"brand","text":"Get Started","link":"/getting-started"},{"theme":"alt","text":"View Tools","link":"/tools/"},{"theme":"alt","text":"Self-Host","link":"/self-hosting/"}]},"features":[{"title":"Local processing","details":"Most document processing runs in your browser. Check each tool and deployment configuration before handling sensitive files."},{"title":"Open source","details":"PagodaPDF source code is published under AGPL-3.0-only."},{"title":"Self-hostable","details":"Build the static site or Docker image from this repository for infrastructure you control."}],"head":[["link",{"rel":"canonical","href":"https://nguyenthaidinh.github.io/Pagoda/docs/"}]]},"headers":[],"relativePath":"index.md","filePath":"index.md"}');
const _sfc_main = { name: "index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h2 id="project-status" tabindex="-1">Project status <a class="header-anchor" href="#project-status" aria-label="Permalink to &quot;Project status&quot;">​</a></h2><p>PagodaPDF is an independent derivative of <a href="https://github.com/alam00000/bentopdf" target="_blank" rel="noreferrer">BentoPDF</a>. It is not affiliated with or endorsed by the original project. See the repository <code>NOTICE</code> and <code>LICENSE</code> files for attribution and licensing information.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
