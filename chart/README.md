# PagodaPDF Helm Chart

This chart deploys an NGINX image built from the PagodaPDF repository. The chart
does not assume that a public PagodaPDF image exists.

## Build an image

```bash
docker build -t pagodapdf:local .
```

For a local Kubernetes cluster that shares the Docker image store:

```bash
helm upgrade --install pagodapdf ./chart \
  --set image.repository=pagodapdf \
  --set image.tag=local \
  --set image.pullPolicy=IfNotPresent
```

For a remote cluster, push the image to a registry you control and pass its full
repository and immutable tag with `--set`.

```bash
kubectl port-forward deploy/pagodapdf 8080:8080
```

Then open `http://localhost:8080`.

The chart supports `ingress` and Gateway API settings in `values.yaml`. Use HTTPS
for public or LAN deployments so browser features that require a secure context
remain available.
