import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"License","description":"","frontmatter":{"head":[["link",{"rel":"canonical","href":"https://nguyenthaidinh.github.io/Pagoda/docs/licensing"}]]},"headers":[],"relativePath":"licensing.md","filePath":"licensing.md"}');
const _sfc_main = { name: "licensing.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="license" tabindex="-1">License <a class="header-anchor" href="#license" aria-label="Permalink to &quot;License&quot;">​</a></h1><p>PagodaPDF is distributed under the <strong>GNU Affero General Public License v3.0 only (AGPL-3.0-only)</strong>. The complete license text is available in the repository <a href="https://github.com/nguyenthaidinh/Pagoda/blob/main/LICENSE" target="_blank" rel="noreferrer"><code>LICENSE</code></a> file.</p><p>PagodaPDF is an independent derivative of <a href="https://github.com/alam00000/bentopdf" target="_blank" rel="noreferrer">BentoPDF</a>. Copyright notices and project attribution are recorded in <a href="https://github.com/nguyenthaidinh/Pagoda/blob/main/NOTICE" target="_blank" rel="noreferrer"><code>NOTICE</code></a>.</p><h2 id="contributions" tabindex="-1">Contributions <a class="header-anchor" href="#contributions" aria-label="Permalink to &quot;Contributions&quot;">​</a></h2><p>Unless explicitly agreed otherwise in writing, contributions submitted to this repository are provided under AGPL-3.0-only. PagodaPDF does not currently require a Contributor License Agreement.</p><h2 id="third-party-components" tabindex="-1">Third-party components <a class="header-anchor" href="#third-party-components" aria-label="Permalink to &quot;Third-party components&quot;">​</a></h2><p>The application uses third-party JavaScript, WebAssembly, font, and other assets. Those components remain governed by their own licenses. Review the dependency metadata and bundled notices before redistributing a build.</p><h2 id="no-commercial-license-offered-here" tabindex="-1">No commercial license offered here <a class="header-anchor" href="#no-commercial-license-offered-here" aria-label="Permalink to &quot;No commercial license offered here&quot;">​</a></h2><p>This repository does not sell or grant BentoPDF&#39;s commercial license. Contact the original project directly if you need rights that are not granted by the AGPL license covering this repository.</p><p>This page is a project summary, not legal advice. Consult qualified counsel when license compliance is important to your deployment or business model.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("licensing.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const licensing = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  licensing as default
};
