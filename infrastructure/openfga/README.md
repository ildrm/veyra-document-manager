# OpenFGA development model

The model centralizes organization, workspace, folder, document, immutable version, and evidence access. `blocked` is an explicit document/folder deny. Time-limited grants remain application-owned: the API writes or supplies a grant only while it is valid and removes it on revocation or expiry.

Run the fixture with the pinned CLI container from this directory:

```bash
docker run --rm \
  --volume "$PWD:/model:ro" \
  --workdir /model \
  openfga/cli:v0.7.20 model test --tests model.test.yaml
```

After starting OpenFGA, create a store and publish the model with the same CLI (or use the playground at `http://localhost:3002`). Run this once for a new local volume. Record the returned store and model IDs in the application environment; never discover them dynamically per request.

```bash
docker run --rm --network veyra-development \
  --volume "$PWD:/model:ro" \
  openfga/cli:v0.7.20 store create \
  --api-url http://openfga:8080 \
  --name Veyra \
  --model /model/model.fga
```

Production must enable OpenFGA authentication/TLS, use a least-privilege database principal, and run model changes through reviewed compatibility tests.
