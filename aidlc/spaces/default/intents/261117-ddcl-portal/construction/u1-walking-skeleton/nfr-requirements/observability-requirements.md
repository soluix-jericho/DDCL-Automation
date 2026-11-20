# NFR Requirements — u1-walking-skeleton — Observability

Sumber: jawaban `nfr-requirements-questions.md` Q6, `aidlc/spaces/default/memory/phases/construction.md` ## Error Handling.

## Monitoring & Logging

| ID | Requirement |
|---|---|
| OBS1.1 | Backend menulis log terstruktur (JSON) ke stdout/stderr — ditangkap oleh `docker compose logs`; tidak ada agregator log eksternal untuk v1 (jawaban Q6). |
| OBS1.2 | Setiap error pada integration boundary (database, file I/O template Excel) dicatat dengan detail teknis di log server, sementara klien hanya menerima pesan generik/jelas tanpa detail infrastruktur (lihat `security-requirements.md` NFR2.3, `reliability-requirements.md` NFR3.2/3.3). |

## Tracing

Tidak ada distributed tracing untuk v1 — backend adalah satu proses monolitik modular, bukan beberapa layanan terdistribusi (`unit-of-work-dependency.md`: seluruh integrasi antar-Unit backend adalah modul internal, bukan jaringan).

## Alerting

Tidak ada alerting eksternal untuk v1 (tidak ada stack monitoring, jawaban Q6).

## Dashboards

Tidak ada dashboard untuk v1.

## SLI/SLO

Tidak ada SLI/SLO formal untuk skeleton ini — lihat `reliability-requirements.md` NFR3.1 (tidak ada SLA uptime untuk v1 lokal).

## Assumptions & Open Questions

None.
