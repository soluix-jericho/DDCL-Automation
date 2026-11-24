# Infrastructure Design — u2-step-library — Monitoring Design

## Sources

- [memory] `nfr-design/observability-design.md`: log JSON per aksi tulis dengan `impact`, peringatan untuk 503 dan `P2024`, tanpa metrik, tracing, atau alerting.
- [memory] U1 `infrastructure-design/monitoring-design.md`: healthcheck Compose dan `docker compose logs`.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Status kesehatan `backend`, `db`, `frontend` | Healthcheck Compose U1, tidak berubah | `healthy` | NFR3.4. |
| Hasil backup pra-migrasi | Log `backend` saat start (`start-prod.sh` menulis baris awal dan akhir: nama berkas dan ukuran) dan `docker compose ps` | Start berhasil (healthy) | Backup yang gagal menghentikan start backend (fail fast); ini sinyal pertama bila migrasi tidak berjalan. |
| Waktu respons rute Library | Field `responseTime` di log permintaan Fastify | p95 < 2 detik (NFR1.5–NFR1.7), dibuktikan test beban | Satu-satunya SLI yang bermakna di skala ini. |
| Jumlah penolakan 503 | Log peringatan `{ reason: "write-limit" }` atau `"pool"` | Idealnya 0 pada pemakaian normal | Menunjukkan batas tulis atau pool terlalu ketat. |
| Jumlah pengulangan deadlock | Log peringatan `{ retry, code }` | Jarang; sering berarti ada masalah urutan kunci | Mendeteksi pelanggaran protokol kunci. |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| — | Tidak ada alerting untuk v1 | — | Operator memeriksa `docker compose ps` dan log secara manual. |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| — | Tidak ada SLO formal; p95 < 2 detik adalah target uji (NFR1.5), bukan SLO operasional | NFR3.4: tanpa SLA uptime untuk v1 lokal. |

## Logs & Tracing

- Log: JSON Pino ke stdout tiap container, dibaca lewat `docker compose logs <service>`; tidak ada agregasi. `start-prod.sh` di backend menulis satu baris awal dan satu baris akhir untuk backup (nama berkas dan ukuran).
- Tracing dan dashboard: tidak ada. `reqId` bawaan Fastify mengaitkan baris log dalam satu permintaan.

## Assumptions & Open Questions

None.
