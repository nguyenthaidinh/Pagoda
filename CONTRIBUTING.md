# Contributing to PagodaPDF

Thank you for improving PagodaPDF. This repository is an independent derivative
of BentoPDF and accepts contributions under AGPL-3.0-only.

## Before Opening An Issue

- Search existing issues first.
- Remove personal, confidential, or sensitive information from sample files.
- Include browser, operating system, PagodaPDF version, exact steps, expected
  result, actual result, and console errors.
- Prefer a minimal generated PDF over a real personal or business document.

Open issues at https://github.com/nguyenthaidinh/Pagoda/issues.

## Development

```bash
git clone https://github.com/nguyenthaidinh/Pagoda.git
cd Pagoda
npm install
npm run dev
```

Before submitting a pull request, run:

```bash
npx tsc --noEmit
npm run test:run
npm run build
```

Keep changes focused. Add regression tests for bug fixes, preserve browser-side
privacy behavior, and update affected translations when changing user-facing
text.

## Pull Requests

- Explain the problem and the behavior changed.
- Link the relevant issue when one exists.
- Include screenshots for visual changes and reproducible fixtures for PDF logic.
- Avoid committing `node_modules`, `dist`, local `.env.*`, audit output,
  temporary files, secrets, or personal documents.
- Keep third-party copyright and license notices intact.

By submitting a contribution, you agree that it is licensed under the
repository's AGPL-3.0-only license and that you have the right to submit it.
PagodaPDF does not currently require a separate Contributor License Agreement.

## Upstream Work

When a change comes from BentoPDF or another project, identify its source and
license in the pull request. Do not copy code whose license is incompatible with
AGPL-3.0-only.

Community standards are defined in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Security reports follow [SECURITY.md](SECURITY.md).

