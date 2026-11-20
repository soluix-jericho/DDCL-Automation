# NFR Requirements — u1-walking-skeleton — Questions

## Sources

- [memory] `requirements.md` NFR1–NFR6: performa ringan (<20 pengguna, interaksi <2 detik), sesi login wajib di semua endpoint (ditegakkan nyata mulai U4), PostgreSQL internal-only, kredensial via env var, durabilitas data permanen, coverage 80% + CI, kecocokan ekspor Excel 1:1 (risiko teknis utama).
- [memory] `team.md` ## Code Style: TypeScript (backend Node.js & frontend), Prettier, ESLint — tapi framework spesifik belum dipilih (keputusan tahap ini).
- [memory] `functional-spec.md`, `rules.md` (Functional Design U1): ADR-005 (Contract Design) — ExcelExportService memuat file template yang sudah ada sebagai basis, sehingga pustaka Excel yang dipilih harus bisa memuat file `.xlsx` yang sudah ada dan mempertahankan styling/merge cell-nya, bukan hanya menulis sel baru dari nol.

## Q1. [Arsitek] Pilihan framework backend

- A. **Fastify** — ringan, TypeScript-native, cocok untuk REST API sederhana seperti `contract-summary.md`, overhead minimal untuk skala <20 pengguna (NFR1)
- B. Framework lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] ORM / akses database

- A. **Prisma** — type-safe, migrasi skema bawaan (cocok untuk skema yang akan diperluas U2–U6 di atas skema U1), dukungan PostgreSQL penuh
- B. ORM/akses data lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [Arsitek] Pustaka pengisian template Excel

ADR-005 mewajibkan memuat file `.xlsx` yang sudah ada dan mempertahankan tata letak/styling-nya, bukan menulis dari nol.

- A. **ExcelJS** — bisa memuat workbook `.xlsx` yang sudah ada, membaca/menulis sel tertentu, dan mempertahankan merge cell serta styling yang sudah ada di file
- B. Pustaka lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Arsitek/Dev] Framework frontend

- A. **React + Vite** — ekosistem matang, build cepat, cocok untuk tim satu pengembang (AI) yang mengerjakan backend dan frontend sekaligus di monorepo yang sama
- B. Framework lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q5. [Arsitek] Mekanisme sesi (fondasi untuk retrofit U4)

U1 berjalan di balik sesi dev-mode satu pengguna tetap (tanpa login nyata), tapi mekanisme sesi yang dipilih sekarang menentukan seberapa besar perubahan saat U4 menegakkan sesi nyata.

- A. Sesi berbasis cookie HTTP-only sisi server (mis. `express-session`-style store, diganti isinya oleh U4 saat ada login nyata) — untuk U1, cookie diisi nilai stub tetap tanpa proses login; endpoint belum memvalidasi apa pun (NFR2 ditegakkan nyata mulai U4, sesuai `unit-of-work.md`)
- B. Mekanisme lain (mis. JWT) (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q6. [Ops] Observability minimal untuk v1 lokal

Tidak ada stack monitoring eksternal untuk v1 (`team.md` ## Deployment — lokal via Docker Compose saja).

- A. Logging terstruktur (JSON) ke stdout/stderr saja (ditangkap Docker Compose logs); tidak ada dashboard, tracing, atau alerting eksternal untuk v1
- B. Kebutuhan observability lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q7. [Arsitek] Target performa untuk skeleton

NFR1 menetapkan interaksi UI umum selesai <2 detik pada skala <20 pengguna.

- A. Target yang sama berlaku ke tiga aksi skeleton (buat step, buat DDCL, unduh Excel) tanpa pengecualian — skala data skeleton (satu step, satu DDCL) jauh di bawah ambang yang bisa membuat 2 detik jadi perhatian
- B. Target berbeda untuk salah satu aksi (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
