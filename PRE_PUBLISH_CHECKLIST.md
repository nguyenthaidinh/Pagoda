# Public repository checklist

Use this checklist before the first full source push to
`https://github.com/nguyenthaidinh/Pagoda`.

## Required

- [ ] Review every file in the first commit; exclude `node_modules/`, `dist/`,
      `.npm-cache/`, `output/`, `tmp/`, local logs, and `.env.*` files.
- [ ] Keep `LICENSE`, `NOTICE`, and upstream history links in
      `public/CHANGELOG.md`.
- [ ] Confirm that `hotropagoda@liotnu.com` is the intended public security and
      support address.
- [ ] Run `npm ci`, `npm run lint`, `npm run test:run`, and `npm run build`.
- [ ] Configure DNS and HTTPS for `https://pagoda.liotnu.com/`.
- [ ] Review repository Actions permissions and enable CodeQL/secret scanning
      where available.
- [ ] Confirm that no real PDF, certificate, private key, token, or user data is
      included in fixtures or screenshots.

## Deployment choices

- [ ] Keep `SITE_URL`, `robots.txt`, docs, and Cloudflare allowlists synchronized
      with the production domain.
- [ ] Configure Cloudflare Worker secrets and deploy the workers only if the
      related tools need them.
- [ ] Publish a container image only to a registry controlled by this project;
      then update `chart/values.yaml` and deployment docs with that image.
- [ ] Decide whether version `2.8.8` should be retained as an upstream-derived
      version or replaced by the first PagodaPDF release version.

## License note

PagodaPDF is published under AGPL-3.0-only and retains upstream attribution. Do
not advertise or resell the original project's separate commercial license.
Obtain legal advice for business-critical licensing decisions.
