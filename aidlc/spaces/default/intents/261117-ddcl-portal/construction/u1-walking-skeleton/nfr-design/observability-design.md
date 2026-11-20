# NFR Design — u1-walking-skeleton — Observability Design

Sumber: `nfr-requirements/observability-requirements.md` (OBS1.1, OBS1.2), jawaban `nfr-design-questions.md` Q5.

## Metrics Collection

Tidak ada koleksi metrik terpisah untuk v1 — log terstruktur (lihat di bawah) adalah satu-satunya sinyal observability, sesuai skala lokal yang tidak butuh dashboard/metrik agregat.

## Structured Logging Design

Logger bawaan Fastify (Pino), dikonfigurasi menulis JSON ke stdout (ditangkap `docker compose logs`, OBS1.1), dengan field standar: `timestamp`, `level`, `reqId` (per-request, dibangkitkan Fastify), `path`, `method`. Setiap error integration boundary dicatat dengan `err` (stack/message) dan `operation` (nama operasi yang gagal) sebagai field tambahan (OBS1.2).

Tidak ada correlation ID lintas-layanan (jawaban Q5) — tidak relevan karena tidak ada layanan terdistribusi; backend adalah satu proses monolitik.

## Distributed Tracing

Tidak ada tracing terdistribusi — tidak berlaku pada arsitektur satu-proses ini.

## Alerting Rules

Tidak ada alerting eksternal untuk v1.

## Dashboard Specifications

Tidak ada dashboard untuk v1.

## SLI/SLO Definitions

Tidak ada SLI/SLO formal untuk skeleton ini (lihat `reliability-requirements.md` NFR3.1).

## Assumptions & Open Questions

None.
