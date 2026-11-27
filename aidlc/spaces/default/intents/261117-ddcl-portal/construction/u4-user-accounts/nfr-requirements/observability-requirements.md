# NFR Requirements — u4-user-accounts — Observability

Sumber: U1 dan U2 `observability-requirements.md` (log JSON ke stdout, tanpa dashboard atau alerting eksternal), `requirements.md` NFR3, `rules.md` BR4.20, jawaban `nfr-requirements-questions.md` Q5 (B).

## Logging

| ID | Requirement |
|---|---|
| NFR3.24 | Backend U4 memakai logger terstruktur (JSON) U1 ke stdout/stderr, ditangkap `docker compose logs`. Peristiwa akun dicatat satu baris info: login berhasil, login gagal, penguncian, logout, akun dibuat, role diubah, akun dinonaktifkan, kata sandi diganti atau diatur ulang admin, kunci dibuka, dan 401/403 per rute. Setiap baris memuat waktu, jenis peristiwa, id pengguna (bila ada), id sesi (bila ada), alamat IP, id permintaan, dan rute. |
| NFR3.25 | Kata sandi, token, hash, dan isi cookie tidak pernah dicatat di log maupun tabel audit (NFR2.29). Login gagal dan penguncian untuk email yang tidak terdaftar hanya masuk log, tidak masuk tabel audit (NFR2.30, yang menyempurnakan BR4.20 dan W2 langkah 7). |
| NFR3.26 | Pemakaian skrip pemulihan (NFR3.22, juga ditulis sebagai `AuditEvent` dengan keterangan `recovery-script`), hasil pembersihan terjadwal (jumlah baris terhapus per jenis, NFR4.20), dan kegagalan pembersihan dicatat di log. Kegagalan tak terduga (500) dicatat dengan detail di log server; klien hanya menerima error generik (BR1.5). |

## Catatan Audit di Database

| ID | Requirement |
|---|---|
| NFR3.27 | Tabel `AuditEvent` (hanya-tambah, BR4.20) berisi peristiwa akun yang bisa dilihat admin lewat layar Audit: waktu, jenis, pelaku, akun sasaran, email, alamat IP, keterangan ringkas. Peristiwa jenis `login_locked` dicatat satu kali saat kunci ditetapkan. Retensi 1 tahun (NFR4.21). |

## Monitoring, Tracing, Alerting

Tidak ada metrik, tracing terdistribusi, dashboard, atau alerting untuk v1 lokal (sama seperti U1 dan U2). Waktu respons dibaca dari log permintaan Fastify bawaan untuk memeriksa NFR1.20 sampai NFR1.23. Lonjakan baris `login_failed` atau `login_locked` pada layar Audit adalah satu-satunya sinyal serangan yang tersedia untuk v1.

## SLI/SLO

Tidak ada SLO formal; target waktu NFR1.20 sampai NFR1.23 dicek lewat test saat Build and Test.

## Assumptions & Open Questions

None.
