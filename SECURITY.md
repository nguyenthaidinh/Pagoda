# Security Policy

## Supported Version

Security fixes are applied to the current `main` branch. Older tags and forks
may not receive fixes.

## Reporting A Vulnerability

Do not open a public issue for an unpatched vulnerability. Email
`hotropagoda@liotnu.com` with:

- A concise description and affected feature.
- Reproduction steps using synthetic, non-sensitive files.
- Browser and operating-system versions.
- Impact and any known workaround.

Do not send passwords, private keys, production tokens, personal documents, or
third-party confidential data. You should receive an acknowledgement within
seven days. Details may be published after a fix is available.

For ordinary bugs, use https://github.com/nguyenthaidinh/Pagoda/issues.

## Deployment Notes

PagodaPDF performs core document processing in the browser, but deployment
security still matters:

- Serve the site over HTTPS and keep the generated security headers.
- Keep Node.js, npm dependencies, container images, and WASM processors updated.
- Configure CORS proxies with a narrow origin allow-list before public use.
- Never put durable secrets in `VITE_*` variables; browser bundles are public.
- Use the non-root container configuration and port 8080 for Docker deployments.
- Review third-party CDN URLs or self-host those assets for stricter control.

Run the available checks before a release:

```bash
npm audit --audit-level=high
npm run test:run
npm run build
```

PagodaPDF is distributed without warranty under AGPL-3.0-only. See [LICENSE](LICENSE).
