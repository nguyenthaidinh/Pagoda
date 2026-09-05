# Static hosting

PagodaPDF builds to static files in `dist/` and can be deployed to GitHub Pages,
Netlify, Vercel, Cloudflare Pages, or a conventional web server.

```bash
npm ci
npm run build
```

Set `SITE_URL` to the public origin and `BASE_URL` to the deployment path before
building. For this repository's GitHub Pages URL:

```text
SITE_URL=https://nguyenthaidinh.github.io/Pagoda
BASE_URL=/Pagoda/
```

The workflow `.github/workflows/static.yml` uses these defaults. Enable GitHub
Pages with **GitHub Actions** as its source before the first deployment.

Do not upload source files, `.env` files, `node_modules`, test output, or temporary
PDFs to the web root. Serve only the generated `dist/` directory and preserve the
generated security headers when the hosting platform supports them.
