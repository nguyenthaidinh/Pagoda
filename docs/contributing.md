# Contributing

Thank you for helping improve PagodaPDF.

## Local setup

Requirements: Node.js 22 or newer, npm, and Git.

```bash
git clone https://github.com/nguyenthaidinh/Pagoda.git
cd Pagoda
npm ci
npm run dev
```

## Before opening a pull request

```bash
npm run lint
npm run test:run
npm run build
```

Keep changes focused and include tests for behavior that can regress. Never add
confidential PDFs, credentials, private keys, certificates, or personal data to
fixtures, screenshots, issues, or commits.

For translated UI, update every supported locale and verify that option labels,
validation messages, and generated download names are translated where expected.

## Reporting problems

Use [GitHub Issues](https://github.com/nguyenthaidinh/Pagoda/issues) for bugs and
feature requests. Report security vulnerabilities privately as described in
[`SECURITY.md`](https://github.com/nguyenthaidinh/Pagoda/blob/main/SECURITY.md).

## License

By submitting a contribution, you agree that it may be distributed under
AGPL-3.0-only. This project does not currently require a CLA.
