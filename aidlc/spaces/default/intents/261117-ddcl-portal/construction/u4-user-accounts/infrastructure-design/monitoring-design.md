# Infrastructure Design — u4-user-accounts — Monitoring Design

## Sources

- [Q4] Tidak ada alat pemantauan baru; resep pemeriksaan log di README dan layar Audit; tanpa peringatan otomatis di v1.
- [memory] `nfr-design/observability-design.md` (NFR3.24–NFR3.27): log JSON Fastify, `req.id` sebagai id korelasi, redaksi field sensitif, tabel `AuditEvent` hanya-tambah dengan layar admin, tanpa metrik atau tracing.
- [memory] U1 dan U2 `monitoring-design.md`: `docker compose logs`, tanpa dashboard atau alerting.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Waktu respons login | Log permintaan Fastify (`responseTime`) | p95 < 1 detik (NFR1.20) | Memeriksa biaya hash dan antrean |
| Tambahan pemeriksaan sesi | Log permintaan Fastify dibandingkan sebelum dan sesudah U4 | ≤ 50 ms p95 (NFR1.21) | Memastikan penegakan sesi tidak memperlambat endpoint U1–U3 |
| Jumlah `503` dari pintu hash | Log, `route=/api/v1/auth/login` | 0 pada beban normal | Antrean hash penuh menandakan beban abnormal atau serangan |
| Jumlah `login_failed` dan `login_locked` | Log dan layar Audit | Lonjakan relatif terhadap hari biasa | Satu-satunya sinyal serangan tebak kata sandi di v1 |
| Hasil pembersihan terjadwal | Log (baris jumlah terhapus per jenis) | Muncul sekali per jam, tanpa peringatan galat | Memastikan retensi NFR4.20 berjalan |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Tidak ada alert otomatis di v1 | — | — | Operator memeriksa log dan layar Audit secara manual (resep di bawah) |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Latensi login | p95 < 1 detik (NFR1.20) | Diperiksa lewat test saat Build and Test (tanpa SLO formal berjalan) |
| Latensi endpoint U1–U3 setelah sesi ditegakkan | p95 < 2 detik (NFR1.22) | Sama |
| Latensi daftar audit | p95 < 2 detik pada 500.000 baris (NFR1.23) | Sama |

## Logs & Tracing

- Log JSON ke stdout, ditangkap `docker compose logs backend`. Id permintaan Fastify menjadi id korelasi; tidak ada tracing terdistribusi. Field sensitif disamarkan oleh penyaring redaksi (NFR3.25).
- Nilai literal field `event` di log ditetapkan sama dengan jenis di enum `AuditEvent` (`login_success`, `login_failed`, `login_locked`, `logout`, `account_created`, `role_changed`, `account_deactivated`, `password_changed`, `password_reset_by_admin`, `lockout_cleared_by_admin`) ditambah `unauthorized` dan `forbidden` untuk 401 dan 403; ini dasar resep di bawah dan test log.
- **Resep README** (tanpa alat tambahan):
  - Penguncian: `docker compose logs backend | grep '"event":"login_locked"'`
  - Login gagal: `docker compose logs backend | grep '"event":"login_failed"'`
  - Galat server: `docker compose logs backend | grep '"level":50'`
  - Perubahan akun: layar Audit (juga baris log backend).
  - Pemakaian skrip pemulihan: jejaknya ada di layar Audit (`detail` = `recovery-script`) dan di keluaran container sekali jalan itu; baris log skrip tidak muncul di `docker compose logs backend` karena `docker compose run` membuat container terpisah, jadi layar Audit adalah jejak yang tahan lama.
- Dashboard: layar Audit (hanya admin) adalah satu-satunya tampilan operasional; tanpa dashboard terpisah.
- Retensi: log dirotasi lewat opsi `json-file` di Compose (`max-size` 10 MB, `max-file` 5, lihat `infrastructure-specification.md`); tabel audit disimpan 1 tahun (NFR4.21).

## Assumptions & Open Questions

None.
