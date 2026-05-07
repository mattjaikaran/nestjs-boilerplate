# Load Testing with k6

## Install k6

```bash
brew install k6
```

## Run tests

```bash
# Auth flow (register → login → refresh → logout)
k6 run load-tests/auth.k6.js

# Todos CRUD (requires a seeded user)
k6 run \
  --env TEST_EMAIL=admin@example.com \
  --env TEST_PASSWORD=Admin123! \
  load-tests/todos.k6.js

# Against staging
k6 run \
  --env BASE_URL=https://staging.example.com \
  --env TEST_EMAIL=loadtest@staging.com \
  --env TEST_PASSWORD=Secret123! \
  load-tests/todos.k6.js
```

## Scenarios defined

Each script defines three named scenarios:

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| `smoke`  | 1   | 30s      | Confirm no obvious breakage |
| `load`/`soak` | 20–50 | 1–3m | Sustained throughput |
| `spike`  | 100 | 50s      | Sudden traffic spike |

## Thresholds

- Error rate < 1% (aborts test on breach)
- p95 latency < 500ms, p99 < 1000ms
- Endpoint-specific thresholds in each script

## Output formats

```bash
# JSON summary for CI
k6 run --out json=load-tests/results.json load-tests/todos.k6.js

# Grafana / InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 load-tests/todos.k6.js
```
