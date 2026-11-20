# Functional Design — u1-walking-skeleton — Questions

## Sources

- [memory] `unit-of-work.md` U1: Boundaries eksplisit — tidak mencakup rollback, multi-step/reorder/duplikasi, Checklist Capture, status/versi, lock, multi-akun/autentikasi nyata, reporting, pengerasan ekspor. Berjalan di balik sesi dev-mode satu pengguna tetap.
- [memory] `unit-of-work-story-map.md`: U1 membuktikan AC1.1.1 & AC1.1.3 (satu kategori) dari US1.1, header minimal dari US2.1, satu step tersusun dari US2.2, AC4.1.1 & AC4.1.2 dari US4.1.
- [memory] `components.md` (Domain Design): bentuk entitas StepLibrary.Step, DdclDocument + ReleaseHeader + ChecklistItem, ExcelExportService.
- [memory] `contract-summary.md`: Contract 2 (`POST /steps`), Contract 3 (`POST /ddcls`, `POST /ddcls/{id}/checklist-items`), Contract 4 (`GET /ddcls/{id}/export`) — bentuk field sudah dipatok di sana.

## Q1. [Arsitek] Entitas minimal untuk skeleton

Mengikuti Boundaries U1, entitas apa yang dipersist untuk skeleton ini — subset paling kecil dari `components.md` yang membuktikan alur buat-step → susun-DDCL → ekspor, tanpa field yang baru relevan di U2/U3 (mis. `pairedRollbackStepId` tetap ada di skema Step karena U2 memperluas skema yang sama, tapi tidak diisi/dipakai logikanya di U1)?

- A. `Step` (id, name, category, kind) dengan `pairedRollbackStepId` ada di skema (nullable, tidak dipakai logika U1) karena U2 memperluas skema yang sama, bukan menggantinya; `DdclDocument` (id, title, status tetap "Draft", createdBy) dengan `createdBy` diisi stub pengguna tetap (lihat Q2); `ReleaseHeader` (ddclId + seluruh field FR1 — tidak ada validasi wajib, itu AC2.1.2 milik U3); `ChecklistItem` (ddclId, stepId, order=1, parameterValues) — hanya satu baris untuk skeleton, tanpa reorder/duplikasi (itu U3)
- B. Subset berbeda (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] Identitas pembuat DDCL tanpa UserAccount (U4 belum dibangun)

`DdclDocument.createdBy` di `components.md` merujuk ke `User` yang dimiliki UserAccount (U4) — U4 belum dibangun di skeleton ini (sesi dev-mode satu pengguna tetap). Bagaimana `createdBy` diisi?

- A. Nilai stub tetap (mis. konstanta `"dev-user"`) ditulis langsung ke `createdBy`, bukan foreign key ke tabel `User` yang belum ada; saat U4 selesai, retrofit mengganti nilai stub ini dengan `User.id` sungguhan (sudah tercatat sebagai pekerjaan U4 di `unit-of-work.md`)
- B. Cara lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [Arsitek] Validasi pembuatan step untuk skeleton

AC1.1.1 (jalur dasar: buat step, langsung terpasang) dan AC1.1.3 (satu kategori) adalah cakupan U1; deteksi nama duplikat (AC1.1.2) eksplisit milik U2. Apa validasi minimal saat membuat step di skeleton ini?

- A. Hanya validasi kehadiran field wajib (`name`, `category` tidak boleh kosong) — tanpa deteksi duplikat nama (ditunda ke U2), mengikuti satu kategori object/parameter yang dipilih untuk demo skeleton
- B. Validasi lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Arsitek] Perilaku saat file template Excel tidak bisa dimuat (kondisi tepi file/path)

ADR-005 (Contract Design) menetapkan ExcelExportService memuat file template yang sudah ada sebagai basis. Bagaimana perilaku saat file template hilang atau tidak bisa dibaca saat ekspor dijalankan?

- A. Ekspor gagal dengan pesan jelas yang menyebutkan path template yang diharapkan dan bahwa file tidak ditemukan/tidak bisa dibaca; tidak ada file setengah jadi yang dihasilkan (selaras dengan panduan Construction — error handling wajib di integration boundary file I/O)
- B. Perilaku lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q5. [Arsitek] Perilaku saat database tidak bisa diakses (kondisi tepi penyimpanan)

Mengikuti panduan Construction (error handling wajib di integration boundary, tidak boleh silent failure): bagaimana perilaku endpoint skeleton (buat step, buat DDCL, tambah checklist item) saat PostgreSQL sedang tidak bisa diakses?

- A. Endpoint mengembalikan error 500 dengan pesan generik ke klien (tidak membocorkan detail koneksi database) dan mencatat detail error di log server; tidak ada data yang tersimpan sebagian
- B. Perilaku lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q6. [Arsitek] Karakter formula-like pada nilai parameter (AC4.1.5) — konfirmasi di luar cakupan U1

`unit-of-work.md` U6 secara eksplisit memiliki sanitasi nilai object/parameter yang berpotensi merusak format sel (AC4.1.5). Apakah skeleton U1 sengaja TIDAK menangani kasus ini (ditulis apa adanya tanpa sanitasi khusus), dan U6 yang menambahkan penanganannya nanti?

- A. Benar — U1 menulis nilai parameter apa adanya ke sel Excel tanpa sanitasi formula-like; AC4.1.5 sepenuhnya cakupan U6
- B. U1 tetap perlu sanitasi dasar (sebutkan alasannya)
- X. Other (please specify)

[Answer]: A

## Q7. [Arsitek] Urutan alur (workflow) skeleton end-to-end

Urutan langkah yang dibuktikan Construction Verification Command: buat step di Library → mulai DDCL baru (isi header) → tambah step itu ke checklist → unduh Excel. Apakah urutan ini sudah lengkap dan benar sebagai satu-satunya alur yang perlu dirancang di `functional-spec.md`, tanpa alur tambahan (mis. edit DDCL yang sudah ada, hapus step)?

- A. Setuju — hanya alur linear ini yang dirancang; edit/hapus di luar cakupan skeleton (lihat Boundaries U1)
- B. Ada alur tambahan yang perlu dirancang (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
