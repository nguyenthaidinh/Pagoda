# Getting Started

PagodaPDF is an open-source, browser-based PDF toolkit derived from BentoPDF.
Most tools process documents locally in the browser. Some optional features may
load runtime assets from configured third-party origins, so review deployment
settings before using sensitive documents.

## Run locally

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/nguyenthaidinh/Pagoda.git
cd Pagoda
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

The generated static site is written to `dist/`. For a subdirectory deployment,
set both `BASE_URL` and `SITE_URL` before building.

Office conversions use `SharedArrayBuffer`. Production hosting must use HTTPS and
send these headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Next steps

- [Explore the tools](/tools/)
- [Self-host PagodaPDF](/self-hosting/)
- [Read the license](/licensing)
- [Contribute](/contributing)
