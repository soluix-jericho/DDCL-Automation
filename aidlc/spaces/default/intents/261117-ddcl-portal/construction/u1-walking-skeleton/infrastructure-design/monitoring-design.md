# Infrastructure Design — u1-walking-skeleton — Monitoring Design

## Sources

- [Q5] Satu healthcheck Compose pada backend (`GET /health`); tanpa dashboard, metrik, atau alerting terkelola; log lewat `docker compose logs`.
- [memory] `nfr-design/observability-design.md`: log JSON Pino ke stdout (OBS1.1), error boundary dengan `err` dan `operation` (OBS1.2), tanpa tracing, tanpa SLI/SLO formal.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Status kesehatan container backend | Compose `healthcheck`: `wget -qO- http://localhost:${BACKEND_PORT}/health` (atau `node` one-liner setara, tanpa menambah dependency); `interval: 10s`, `timeout: 3s`, `retries: 3`, `start_period: 20s` (memberi waktu `prisma migrate deploy`) | `healthy` | Sinyal otomatis bahwa backend hidup (NFR3.1). Sesuai `reliability-design.md`, `/health` memeriksa koneksi DB bisa dijangkau, jadi backend menjadi `unhealthy` saat DB turun (dikehendaki: menandai gangguan; endpoint lain tetap 500 generik, NFR3.2). Template yang hilang tidak membuat `/health` gagal; efeknya hanya pada ekspor (500 generik + log). |
| Status kesehatan container `db` | Compose `healthcheck`: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`; `interval: 5s`, `timeout: 3s`, `retries: 10` | `healthy` | Backend menunggu db sehat sebelum start (`service_healthy`). |
| Status kesehatan container `frontend` | Compose `healthcheck`: HTTP GET ke port frontend sendiri; `interval: 10s`, `timeout: 3s`, `retries: 3` | `healthy` | Sinyal bahwa UI tersaji. |

Tidak ada koleksi metrik lain untuk v1.

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| — | Tidak ada alerting untuk v1 | — | Operator memeriksa `docker compose ps` dan log secara manual. |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| — | Tidak ada SLO formal | NFR3.1: tidak ada SLA uptime untuk v1 lokal. |

## Logs & Tracing

- Log: JSON dari Pino ke stdout tiap container; dibaca lewat `docker compose logs` (OBS1.1). Field: `timestamp`, `level`, `reqId`, `path`, `method`; error boundary menambah `err` dan `operation` (OBS1.2).
- Tracing: tidak ada. Dashboard: tidak ada.

## Assumptions & Open Questions

None.
