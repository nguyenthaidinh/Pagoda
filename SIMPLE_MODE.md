# Simple Mode

`SIMPLE_MODE=true` builds PagodaPDF without the public landing-page chrome while
keeping the PDF tool pages. This is useful for an internal deployment.

```bash
SIMPLE_MODE=true npm run build
```

On Windows PowerShell:

```powershell
$env:SIMPLE_MODE='true'
npm.cmd run build
```

Simple Mode is a build option, not a separate license or commercial edition.
Every PagodaPDF distribution remains subject to `LICENSE` and applicable
third-party licenses.
