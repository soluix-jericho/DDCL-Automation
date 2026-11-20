# NFR Design — u1-walking-skeleton — Reliability Design

Sumber: `nfr-requirements/reliability-requirements.md` (NFR3.1–3.3, NFR4.1, NFR6.1), `functional-spec.md` (langkah 9 alur skeleton — gagal muat template berhenti di titik ini, sesuai desain error handling di bawah), jawaban `nfr-design-questions.md` Q1.

## Pola Resiliensi

Tidak ada circuit breaker atau bulkhead (jawaban Q1) — skeleton hanya punya satu dependensi lokal (PostgreSQL di Docker Compose yang sama), yang gagal/berhasil sebagai satu kesatuan; pola itu bernilai untuk panggilan jaringan ke layanan eksternal yang bisa gagal sebagian, bukan untuk kasus ini.

## Error Handling (desain konkret dari BR1.4/BR1.5)

```
try {
  // operasi database (Prisma) atau file I/O (ExcelJS memuat template)
} catch (err) {
  log.error({ err, operation }, "operasi gagal")  // detail ke log server (NFR3.2/3.3)
  return 500 dengan pesan generik ke klien          // tidak membocorkan detail infrastruktur
}
```

Tidak ada retry otomatis pada operasi tulis (POST) — sesuai `contract-summary.md` Q5 (retry hanya untuk GET idempotent, dan tidak ada GET yang menulis data di skeleton ini).

## Health Checks

Satu endpoint health check sederhana (`GET /health`) yang memeriksa koneksi database bisa dijangkau — dipakai Docker Compose untuk `healthcheck` container backend (bukan bagian dari Contract Design, murni infrastruktur internal).

## Backup/Recovery

Tidak ada strategi backup/recovery formal untuk v1 (`reliability-requirements.md`).

## Data Durability

Data `Step`, `DdclDocument`, `ReleaseHeader`, `ChecklistItem` disimpan di volume Docker PostgreSQL yang persisten antar-restart container (NFR4.1) — tidak ada mekanisme penghapusan otomatis.

## Export Fidelity (NFR6.1)

Tidak ada desain teknis tambahan di luar yang sudah ditetapkan ADR-005 (Contract Design) dan `rules.md` BR1.4/BR1.6 — kecocokan 1:1 dibuktikan manual pada checkpoint skeleton (Construction Verification Command), bukan lewat pola resiliensi.

## Assumptions & Open Questions

None.
