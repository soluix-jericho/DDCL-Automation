# Domain Design — Questions

## Sources

- [memory] `requirements.md` (Requirements Analysis): FR1–FR10, NFR1–NFR6.
- [memory] `stories.md` (User Stories): 14 story across 6 kelompok alur kerja.
- [memory] `team-practices.md` (Practices Discovery): backend Node.js/TypeScript, frontend terpisah, PostgreSQL.

## Q1. [Batas Komponen] Apakah pembagian 4 komponen logis berikut sudah masuk akal?

Usulan pembagian (code yang ditulis, bukan infrastruktur):

1. **UserAccount** — akun pengguna dan identitas (FR9, NFR2).
2. **StepLibrary** — step reusable, kategori object/parameter, dan pasangan rollback-nya (FR2, FR4 sisi penetapan pasangan di Library).
3. **DdclDocument** — jantung produk: komposisi DDCL (header, checklist, rollback terpasang, capture), status & versi (vN), dan lock saat diedit (FR1, FR3, FR5, FR6, FR10).
4. **ExcelExportService** — menghasilkan file Excel dari sebuah DdclDocument sesuai template (FR7).

- A. Setuju dengan pembagian 4 komponen di atas
- B. Perlu digabung/dipecah berbeda (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Opsi Desain] Bagaimana menangani "jumlah DDCL yang memakai step ini" (FR2.3) tanpa membuat StepLibrary dan DdclDocument saling bergantung (siklus)?

Data `ChecklistItem` (menyebut step mana yang dipakai) dimiliki oleh DdclDocument, tapi tampilan jumlah pemakaian ditampilkan di layar Library (milik StepLibrary). Kalau StepLibrary memanggil DdclDocument untuk hitung pemakaian, dan DdclDocument juga memanggil StepLibrary untuk ambil detail step saat menyusun checklist, itu jadi saling memanggil (siklus) — dianggap bau desain yang buruk.

- A. Penggabungan data (hitung jumlah pemakaian) dilakukan di lapisan API/endpoint, yang memanggil StepLibrary (daftar step) dan DdclDocument (hitung pemakaian) secara terpisah lalu digabung sebelum dikirim ke frontend — bukan StepLibrary memanggil DdclDocument secara langsung
- B. Cara lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [Batas Komponen] Apakah lock "sedang diedit" (US6.1) sebaiknya jadi bagian dari DdclDocument (bukan komponen terpisah)?

Karena lock selalu terikat ke satu DDCL tertentu (bukan konsep umum lintas semua data), usulan: lock disimpan sebagai atribut pada DdclDocument itu sendiri (siapa yang mengunci, kapan), bukan komponen "LockManager" generik terpisah.

- A. Setuju, lock jadi bagian dari DdclDocument
- B. Lebih baik komponen terpisah (sebutkan alasan)
- X. Other (please specify)

[Answer]: A

## Q4. [Versi DDCL] Apakah versi DDCL (v2, v3, ...) cukup disimpan sebagai DdclDocument yang menunjuk ke DDCL induknya (self-reference), bukan entitas/komponen "DdclVersion" terpisah?

- A. Setuju — setiap versi adalah DdclDocument biasa yang punya referensi opsional ke DDCL induk
- B. Lebih baik dimodelkan sebagai entitas/komponen terpisah (sebutkan alasan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Q1: Setuju dengan 4 komponen logis — UserAccount, StepLibrary, DdclDocument, ExcelExportService.
- Q2: Jumlah pemakaian step (FR2.3) digabung di lapisan API, bukan lewat StepLibrary memanggil DdclDocument langsung — menghindari siklus.
- Q3: Lock "sedang diedit" jadi atribut pada DdclDocument, bukan komponen terpisah.
- Q4: Versi DDCL (v2, v3, ...) disimpan sebagai DdclDocument dengan referensi opsional ke DDCL induk, bukan entitas terpisah.

- Looks correct
- Request changes

[Answer]: Looks correct
