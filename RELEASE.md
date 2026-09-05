# PagodaPDF release guide

PagodaPDF releases are prepared locally and published deliberately. The release
script never commits, tags, pushes, or publishes an image on your behalf.

## Before a release

1. Make sure the working tree contains only the intended changes.
2. Run the checks:

   ```bash
   npm ci
   npm run lint
   npm run test:run
   npm run build
   ```

3. Review `CHANGELOG.md`, `NOTICE`, `LICENSE`, and third-party notices.
4. Choose the semantic version bump: `patch`, `minor`, or `major`.

## Prepare the version

```bash
npm run release
# or: npm run release:minor
# or: npm run release:major
```

This updates `package.json`, `package-lock.json`, and the Helm chart versions.
Review those changes before committing.

## Publish to GitHub

```bash
git add package.json package-lock.json chart/Chart.yaml CHANGELOG.md
git commit -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

Create the GitHub release from the tag only after CI passes. PagodaPDF does not
currently publish a container image automatically. Configure a registry owned by
the PagodaPDF project before documenting or publishing container images.
