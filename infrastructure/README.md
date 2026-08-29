# Local platform infrastructure

This Compose project is a development environment, not a production topology. Every published port is bound to loopback. The credentials in `.env.example` are deliberately labeled and suitable only for an isolated developer machine.

## Start the stack

From the repository root:

```bash
cp infrastructure/.env.example infrastructure/.env
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml up -d
```

The default profile starts PostgreSQL/pgvector, MinIO and bucket initialization, Valkey, OpenFGA (migration then server), and Keycloak. Add durable workflows and telemetry when working on those areas:

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml \
  --profile workflow --profile observability up -d
```

| Service                          | Local endpoint                                         | Purpose                                    |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| PostgreSQL                       | `localhost:5432`                                       | Canonical relational data and vectors      |
| MinIO API / console              | `localhost:9000` / `localhost:9002`                    | Quarantine, trusted, and derived objects   |
| Valkey                           | `localhost:6379`                                       | Cache, locks, rate limits, ephemeral state |
| Keycloak / management            | `localhost:8080` / `localhost:9001`                    | Development OIDC realm and health/metrics  |
| OpenFGA HTTP / gRPC / playground | `localhost:8081` / `localhost:8082` / `localhost:3002` | Relationship authorization                 |
| Temporal / UI                    | `localhost:7233` / `localhost:8233`                    | Durable workflow development               |
| OTLP gRPC / HTTP                 | `localhost:4317` / `localhost:4318`                    | Application telemetry ingress              |
| Prometheus                       | `localhost:9090`                                       | Metrics                                    |
| Grafana                          | `localhost:3001`                                       | Telemetry exploration                      |
| Loki / Tempo                     | `localhost:3100` / `localhost:3200`                    | Logs and traces                            |

The first PostgreSQL initialization creates separate databases for OpenFGA, Keycloak, Temporal, and Temporal visibility, and enables `vector` only in the Veyra database. MinIO initialization creates private, versioned buckets. Application schema migrations are intentionally separate.

## Operate and troubleshoot

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml ps
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml logs --tail=100 postgres openfga keycloak
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml config --quiet
```

Stop containers without deleting state:

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml down
```

`down --volumes` permanently removes all local databases and objects. Use it only when deliberately resetting development data.

If an initialization script changes after PostgreSQL has already created its volume, either apply the equivalent migration manually or deliberately reset the local volume. Entrypoint initialization scripts do not rerun on existing volumes.

## Production differences

Production must use managed secrets, TLS, private networking, least-privilege database users per service, object-lock/replication policies where required, authenticated OpenFGA, a hardened external IdP, multi-instance Temporal, and durable telemetry backends. Image updates require compatibility and vulnerability review; production images should be pinned by digest.
