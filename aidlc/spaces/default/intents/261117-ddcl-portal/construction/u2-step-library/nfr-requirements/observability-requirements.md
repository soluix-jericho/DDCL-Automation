# NFR Requirements — u2-step-library — Observability

Sumber: U1 `observability-requirements.md` (log JSON ke stdout, tanpa dashboard atau alerting eksternal), `requirements.md` NFR3.

## Logging

| ID | Requirement |
|---|---|
| NFR3.5 | Backend U2 memakai logger terstruktur (JSON) U1 ke stdout/stderr, ditangkap `docker compose logs`. Setiap aksi tulis Library (buat, ubah, hapus step; buat, ubah, hapus bundle) mencatat satu baris info berisi jenis aksi, id, dan jumlah dampak (bundle terhapus, pasangan rollback dikosongkan). Isi langkah dan isi lampiran tidak dicatat di log. |
| NFR3.6 | Kegagalan tak terduga (500) dicatat dengan detail di log server; klien hanya menerima error generik (BR1.5). Penolakan validasi (400), nama sama (409), dan tidak ditemukan (404) dicatat tingkat info/peringatan, bukan error. |

## Monitoring, Tracing, Alerting

Tidak ada metrik, tracing terdistribusi, dashboard, atau alerting untuk v1 lokal (sama seperti U1). Waktu respons dapat dibaca dari log permintaan Fastify bawaan untuk memeriksa target NFR1.5 sampai NFR1.7.

## SLI/SLO

Tidak ada SLO formal; target waktu NFR1.5 sampai NFR1.7 dicek manual atau lewat test saat Build and Test.

## Assumptions & Open Questions

None.
