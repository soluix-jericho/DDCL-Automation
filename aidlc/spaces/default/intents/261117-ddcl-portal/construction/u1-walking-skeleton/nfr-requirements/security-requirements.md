# NFR Requirements — u1-walking-skeleton — Security

Sumber: `requirements.md` NFR2, jawaban `nfr-requirements-questions.md` Q5, `aidlc/spaces/default/memory/phases/construction.md` ## Security.

## Autentikasi & Sesi

| ID | Requirement |
|---|---|
| NFR2.1 | Sesi disimpan di cookie HTTP-only sisi server (jawaban Q5) — isi cookie untuk skeleton ini adalah nilai stub tetap, bukan hasil proses login nyata. |
| NFR2.2 | Endpoint skeleton (`POST /steps`, `POST /ddcls`, `POST /ddcls/{id}/checklist-items`, `GET /ddcls/{id}/export`) TIDAK memvalidasi sesi apa pun di Unit ini — penegakan sesi login valid di seluruh endpoint (NFR2 penuh) adalah tanggung jawab u4-user-accounts, yang menambahkan middleware validasi ke endpoint yang sama tanpa mengubah bentuk kontraknya (`unit-of-work.md` U4). |

## Perlindungan Data & Infrastruktur

| ID | Requirement |
|---|---|
| NFR2.3 | Kredensial database (PostgreSQL) HARUS dimuat dari environment variable saat startup aplikasi backend, tidak pernah ditulis langsung di kode sumber atau file konfigurasi yang masuk version control. |
| NFR2.4 | Container PostgreSQL di Docker Compose HARUS hanya dapat diakses dari jaringan internal Docker Compose (tidak mem-publish port database ke host/jaringan publik). |
| NFR2.5 | Data operasional (host, database, image — lihat FR7.1) ditulis apa adanya tanpa masking di seluruh lapisan (tidak ada kontrol masking tambahan di skeleton), sesuai keputusan NFR2 inception bahwa data operasional tidak memerlukan masking. |

## Kepatuhan

Tidak ada kebutuhan kepatuhan (compliance) regulasi yang teridentifikasi untuk v1 (`requirements.md` Out of Scope — tidak ada integrasi eksternal, tidak ada data personal di luar akun pengguna internal).

## Threat Considerations (untuk skala skeleton ini)

- Karena endpoint belum memvalidasi sesi (NFR2.2), skeleton ini TIDAK AMAN untuk dijalankan di luar jaringan Docker Compose lokal dan TIDAK boleh diekspos ke jaringan publik sebelum u4-user-accounts selesai — ini bukan kelonggaran keamanan produksi, melainkan batas cakupan Unit yang eksplisit dicatat di `unit-of-work.md`.

## Assumptions & Open Questions

None.
