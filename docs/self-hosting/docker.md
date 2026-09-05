# Deploy with Docker

PagodaPDF currently provides Dockerfiles but does not publish an official image.
Build from the checked-out source to avoid pulling an unrelated upstream image.

## Docker Compose

```bash
docker compose up --build -d
docker compose ps
```

Open `http://localhost:3000`. Stop it with:

```bash
docker compose down
```

## Build directly

```bash
docker build -t pagodapdf:local .
docker run --rm -p 3000:8080 --name pagodapdf pagodapdf:local
```

For the non-root Dockerfile:

```bash
docker build -f Dockerfile.nonroot -t pagodapdf:nonroot .
docker run --rm -p 3000:8080 --name pagodapdf pagodapdf:nonroot
```

## Production requirements

- Use HTTPS outside localhost.
- Preserve `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`.
- Review CSP and external WASM/OCR origins.
- Pin a source commit and image tag for reproducible deployments.
- Do not mount user uploads because the application is designed for browser-side
  document processing.
