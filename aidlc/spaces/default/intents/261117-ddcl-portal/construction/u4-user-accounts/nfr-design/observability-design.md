# NFR Design — u4-user-accounts — Observability

Sumber: `nfr-requirements/observability-requirements.md` (NFR3.24–NFR3.27), U1 dan U2 `observability-design.md`, `rules.md` BR4.20, jawaban `nfr-design-questions.md` Q4.

## Pencatatan Log

- Logger JSON Fastify yang sudah ada ke stdout, ditangkap `docker compose logs`. Id permintaan Fastify (`req.id`) menjadi id korelasi dan ikut di setiap baris, termasuk baris audit.
- Peristiwa akun (NFR3.24) satu baris info dengan field tetap: `event`, `time`, `userId` (bila ada), `sessionId` (bila ada), `ip`, `requestId`, `route`, dan `outcome`. Jenis peristiwa: login berhasil, login gagal, penguncian, logout, akun dibuat, role diubah, akun dinonaktifkan, kata sandi diganti atau diatur ulang, kunci dibuka, 401 dan 403 per rute.
- Penyaring redaksi pada pencatat log menyamarkan `password`, `passwordHash`, `tokenHash`, `token`, `authorization`, dan `cookie` di semua objek yang dicatat (NFR3.25).
- Login gagal dan penguncian untuk email tidak terdaftar hanya masuk log (NFR2.30). Log memuat email yang diketik pada peristiwa login.
- Penolakan validasi (400), konflik (409), dan 401/403 dicatat tingkat info atau peringatan, bukan error; kegagalan tak terduga (500) dicatat dengan detail di server dan klien hanya menerima error generik (NFR3.26).
- Pembersihan terjadwal mencatat jumlah baris terhapus per jenis; kegagalan dicatat sebagai peringatan. Skrip pemulihan mencatat setiap pemakaian (juga sebagai `AuditEvent`).

## Catatan Audit di Database (NFR3.27, BR4.20)

- Tabel `AuditEvent` hanya-tambah; ditulis oleh satu modul pencatat dengan dua mode (dalam transaksi pemanggil, atau upaya terbaik) sesuai tabel semantik di `reliability-design.md`.
- Layar Audit dan `GET /api/v1/audit-events` hanya untuk admin, hanya baca, terbaru lebih dulu, kursor `(occurredAt, id)`, filter jenis dan rentang tanggal.
- Retensi 1 tahun dengan pembersihan per jam (NFR4.20).

## Metrik, Tracing, Alerting

Tidak ada metrik, tracing terdistribusi, dashboard, atau alerting untuk v1 lokal. Waktu respons dibaca dari log permintaan Fastify bawaan untuk memeriksa NFR1.20 sampai NFR1.23. Lonjakan `login_failed` dan `login_locked` di layar Audit adalah satu-satunya sinyal serangan v1.

## SLI/SLO

Tidak ada SLO formal; target waktu diperiksa lewat test saat Build and Test.

## Assumptions & Open Questions

None.
