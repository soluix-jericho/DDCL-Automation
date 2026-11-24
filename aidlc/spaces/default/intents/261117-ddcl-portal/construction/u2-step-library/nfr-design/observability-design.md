# NFR Design — u2-step-library — Observability Design

Sumber: `nfr-requirements/observability-requirements.md` (NFR3.5, NFR3.6), U1 `observability-design.md`.

## Logging Terstruktur

Logger Pino bawaan Fastify (JSON ke stdout) seperti U1. Tambahan U2:

- Setiap aksi tulis sukses mencatat satu baris info: `{ action, entity: "step"|"bundle", id, impact }`. `impact` memuat jumlah bundle terhapus, pasangan rollback dikosongkan, item checklist yang `stepId`-nya dikosongkan (NFR3.5).
- Isi langkah dan isi lampiran tidak pernah dimasukkan ke log; konfigurasi serializer Pino menghapus `req.body` untuk rute Library.
- Pengulangan transaksi karena deadlock mencatat peringatan `{ retry, code }`; 409 "coba lagi" dicatat peringatan. 400, 404, dan 409 nama dicatat info atau peringatan, hanya 500 yang error dengan detail (NFR3.6).
- Penolakan oleh pembatas tulis serentak (503, `performance-design.md`) dan `P2024` dicatat peringatan `{ reason: "write-limit"|"pool" }` supaya penyebab lambat atau ditolak bisa dibedakan.

## Metrik, Tracing, Alerting, Dashboard

Tidak ada untuk v1 lokal. Target waktu NFR1.5–NFR1.7 dibaca dari `responseTime` di log permintaan Fastify dan dibuktikan test beban di Build and Test.

## SLI/SLO

Tidak ada SLO formal. ID korelasi memakai `reqId` bawaan Fastify yang sudah ada di setiap baris log permintaan.

## Assumptions & Open Questions

None.
