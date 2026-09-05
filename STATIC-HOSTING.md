# Static hosting

PagodaPDF builds to static files in `dist/` and can be deployed to GitHub Pages,
Netlify, Vercel, Cloudflare Pages, or a conventional web server.

```bash
npm ci
npm run build
```

Set `SITE_URL` to the public origin and `BASE_URL` to the deployment path before
building. For the PagodaPDF production domain:

```text
SITE_URL=https://pagoda.liotnu.com
BASE_URL=/
```

The production build can be served from the root of the configured domain.

Do not upload source files, `.env` files, `node_modules`, test output, or temporary
PDFs to the web root. Serve only the generated `dist/` directory and preserve the
generated security headers when the hosting platform supports them.
