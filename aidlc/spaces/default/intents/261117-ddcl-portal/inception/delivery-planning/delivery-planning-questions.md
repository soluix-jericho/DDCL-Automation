# Delivery Planning — Questions

## Sources

- [memory] `team.md` ## Walking Skeleton: tim sudah menyepakati u1-walking-skeleton sebagai irisan skeleton pertama.
- [memory] `unit-of-work.md` / `unit-of-work-dependency.md` (Units Generation): 6 Unit, DAG topologis, u1 tidak bergantung apa pun.
- [memory] `contract-summary.md` (Contract Design): kepemilikan kontrak per-Unit; 2 open question (durasi timeout lock FR10.1, tampilan versi DDCL) yang menunggu Functional Design.
- [memory] `aidlc-state.md`: Team Formation (1.5) di-skip untuk scope mvp — satu pembangun AI (aidlc-developer-agent) untuk seluruh Bolt, Construction Checkpoints enabled, Unit-major, serial.

## Strategic Questions

### Q1. [Delivery] Apa yang dibangun duluan?

Tim sudah menyepakati **u1-walking-skeleton** sebagai Bolt pertama — Bolt di sini berarti satu bagian pekerjaan Construction yang dibangun lalu dibuktikan jalan ujung-ke-ujung sebelum lanjut ke bagian berikutnya. Setelah skeleton terbukti jalan, bagaimana urutan sisanya (u2, u3, u4, u5, u6) ditentukan: risiko paling tinggi duluan, nilai paling tinggi duluan, atau campuran keduanya?

- A. Campuran — setelah skeleton (u1): u2 (Library penuh) lalu u4 (akun pengguna nyata) duluan untuk mengecilkan area yang perlu diuji ulang saat stub sesi dev-mode dicabut, baru u3 (komposisi DDCL penuh, Unit terbesar/bernilai), lalu u6 (pengerasan ekspor — risiko teknis utama NFR6) sebelum u5 (reporting, nilai lebih rendah, hanya baca data)
- B. Risiko paling tinggi duluan secara ketat (mis. u6 pengerasan ekspor sesegera mungkin)
- C. Nilai paling tinggi duluan secara ketat (mis. u3 komposisi DDCL sesegera mungkin setelah skeleton)
- X. Other (please specify)

[Answer]: A

### Q2. [Delivery] Apakah urutan dinilai dengan model skor formal (mis. WSJF — nilai bisnis + urgensi dibagi ukuran pekerjaan)?

- A. Tidak perlu model skor formal — urutan di atas (Q1) sudah cukup dijelaskan secara naratif di `risk-and-sequencing-rationale.md` (pendekatan risk-first + walking-skeleton-first, sesuai skala proyek mvp)
- B. Ya, pakai skor WSJF formal untuk tiap Bolt
- X. Other (please specify)

[Answer]: A

### Q3. [Delivery] Seberapa besar satu Bolt: satu Unit, beberapa Unit digabung, atau irisan tipis lintas-Unit?

- A. Satu Bolt = satu Unit (6 Bolt total, mengikuti Unit yang sudah ditetapkan di Units Generation) — konsisten dengan Construction Iteration unit-major yang sudah tercatat
- B. Gabungkan beberapa Unit kecil ke satu Bolt (sebutkan yang mana)
- X. Other (please specify)

[Answer]: A

### Q4. [Delivery] Bisakah beberapa Bolt dibangun bersamaan, atau harus satu demi satu?

- A. Satu demi satu (serial) — sesuai Construction Execution: serial dan satu pembangun AI tunggal yang sudah tercatat di `aidlc-state.md` (Team Formation di-skip untuk scope mvp); urutan DAG yang memungkinkan paralel (mis. u2 & u4, atau u5 & u6) tetap dicatat sebagai peluang di `unit-of-work-dependency.md` untuk referensi masa depan, tapi tidak dieksekusi paralel sekarang
- B. Bangun beberapa Bolt paralel sekarang (sebutkan yang mana)
- X. Other (please specify)

[Answer]: A

### Q5. [Delivery] Adakah hal di luar tim ini yang bisa menghambat (API eksternal, data, persetujuan, serah terima tim lain)?

- A. Tidak ada — v1 sepenuhnya lokal via Docker Compose, tanpa integrasi otomatis ke sistem lain dan tanpa persetujuan eksternal (`requirements.md` Constraints, NFR3); `external-dependency-map.md` dibuat kosong/ringan
- B. Ada (sebutkan: siapa pemiliknya, berapa lama, Bolt mana yang terhambat, dan apa yang dilakukan jika terlambat)
- X. Other (please specify)

[Answer]: A

### Q6. [Delivery] Apa yang paling dikhawatirkan dari pembangunan ini, supaya ditangani lebih awal?

- A. Dua hal sudah teridentifikasi dan sudah ditempatkan secara eksplisit di urutan Bolt: (1) kecocokan ekspor Excel 1:1 dengan template (NFR6/ADR-005) — ditangani lewat skeleton (u1) yang membuktikan mapping sel dasar bekerja, lalu diperkeras di u6; (2) retrofit sesi dev-mode ke sesi nyata (u4) — dikecilkan area regresinya dengan menjalankan u4 sedini mungkin setelah u1/u2
- B. Ada kekhawatiran lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Per-Bolt Questions

Jawaban di atas (Q1–Q4) menentukan isi tabel Bolt berikut. Setiap baris memakai satu pembangun AI yang sama (`aidlc-developer-agent`), karena Team Formation di-skip untuk scope mvp.

### Q7. [Delivery] Bolt 1 — u1-walking-skeleton (skeleton)

- **Definition of Done**: Satu step reusable dibuat di Library, disusun jadi satu DdclDocument minimal, diekspor sebagai file Excel yang bisa dibuka dan cocok tata letak `DDCL BCAS PROD 202611 - TEMPLATE.xlsx`, dibuktikan dengan Construction Verification Command yang menunjukkan hasil ujung-ke-ujung nyata (bukan hanya dokumen desain), lalu disetujui manusia di checkpoint skeleton.
- **Confidence hypothesis**: Tiga komponen domain (StepLibrary, DdclDocument, ExcelExportService) benar-benar tersambung dan pendekatan ADR-005 (isi ulang file template) bekerja secara nyata, sebelum fitur lain dibangun di atasnya.
- **Expected demo**: Buat satu step → susun satu DDCL → unduh file Excel hasil ekspor dan buka untuk dibandingkan dengan template.

Setuju dengan Definition of Done, confidence hypothesis, dan demo di atas untuk Bolt 1?

- A. Setuju
- B. Ubah (sebutkan)
- X. Other (please specify)

[Answer]: A

### Q8. [Delivery] Bolt 2 — u2-step-library

- **Definition of Done**: CRUD step (forward & rollback) penuh, deteksi nama duplikat (AC1.1.2), form kategori object/parameter penuh per kategori (AC1.1.3), jumlah pemakaian step ditampilkan di layar Library (FR2.3, digabung di lapisan API per ADR-002/Contract 2), penghapusan step tidak memengaruhi DDCL lama (FR2.4), penetapan/pengeditan pasangan rollback (US1.3) — seluruhnya lolos test dan review sesuai Testing Posture tim.
- **Confidence hypothesis**: Library sebagai aset reusable lintas-DDCL (tujuan utama #1 produk ini) benar-benar berdiri sendiri dari data DDCL yang memakainya, sebelum DDCL Composition (u3) dibangun di atasnya.
- **Expected demo**: Buat beberapa step dengan kategori berbeda, tetapkan pasangan rollback, hapus satu step yang sudah dipakai sebuah DDCL dan tunjukkan DDCL lama tidak berubah.

Setuju untuk Bolt 2?

- A. Setuju
- B. Ubah (sebutkan)
- X. Other (please specify)

[Answer]: A

### Q9. [Delivery] Bolt 3 — u4-user-accounts

- **Definition of Done**: Entitas User penuh, alur login/logout, middleware penegakan sesi di seluruh endpoint yang sudah ada (u1, u2), layar login dan manajemen akun dasar, stub sesi dev-mode dari u1 dicabut, dan regresi terhadap endpoint u1/u2 yang sudah ada dijalankan ulang dan lolos.
- **Confidence hypothesis**: Autentikasi nyata bisa menggantikan stub dev-mode tanpa merusak fitur yang sudah berjalan (u1, u2) — area retrofit masih kecil di titik ini, sebelum u3 (Unit terbesar) menambah lebih banyak endpoint yang juga perlu diretrofit.
- **Expected demo**: Dua akun berbeda login terpisah, akses ditolak tanpa sesi valid, endpoint Library dan skeleton dari Bolt 1–2 tetap berfungsi setelah retrofit.

Setuju untuk Bolt 3, termasuk menempatkannya sebelum u3 (bukan setelahnya)?

- A. Setuju
- B. Ubah (sebutkan, termasuk jika ingin u4 dipindah ke setelah u3)
- X. Other (please specify)

[Answer]: A

### Q10. [Delivery] Bolt 4 — u3-ddcl-composition

- **Definition of Done**: Header Release Document lengkap + validasi (US2.1), susun/urutkan ulang/duplikasi baris step (US2.2), rollback otomatis terpasang (US2.3), Checklist Capture opsional (US2.4), siklus status Draft → Sudah Dikirim read-only (US3.1), versi baru (vN) terhubung ke DDCL induk (US3.2), lock saat diedit dengan pelepasan otomatis (US6.1) — durasi timeout lock ditentukan di Functional Design sebelum Unit ini mulai Code Generation (lihat open question Contract Design).
- **Confidence hypothesis**: Seluruh alur inti produk (komposisi DDCL lengkap, bukan hanya versi minimal dari skeleton) benar-benar bisa menggantikan proses ketik-ulang manual yang jadi masalah awal (lihat `requirements.md` Intent Analysis).
- **Expected demo**: Susun satu DDCL dengan banyak step, urutkan ulang, lihat rollback otomatis terpasang, kirim DDCL (jadi read-only), buat versi v2 darinya.

Setuju untuk Bolt 4, termasuk prasyarat bahwa Functional Design harus menetapkan durasi timeout lock sebelum Bolt ini mulai Code Generation?

- A. Setuju
- B. Ubah (sebutkan)
- X. Other (please specify)

[Answer]: A

### Q11. [Delivery] Bolt 5 — u6-excel-export-hardening

- **Definition of Done**: Validasi kelengkapan DDCL sebelum ekspor dengan pesan jelas (AC4.1.3), step melebihi baris per fase tetap menghasilkan file valid (AC4.1.4), nilai object/parameter yang berpotensi merusak format sel ditulis sebagai teks biasa (AC4.1.5) — seluruhnya diuji dengan DDCL hasil Bolt 4 yang benar-benar punya banyak step, bukan skenario satu-step dari skeleton.
- **Confidence hypothesis**: Risiko teknis utama produk ini (NFR6 — kecocokan ekspor 1:1 dengan template) bertahan juga pada kasus tepi nyata, bukan hanya kasus sederhana yang dibuktikan skeleton.
- **Expected demo**: Ekspor satu DDCL dengan step melebihi kapasitas baris template untuk satu fase, dan satu DDCL dengan nilai parameter yang diawali `=`; keduanya tetap menghasilkan file Excel valid dan aman.

Setuju untuk Bolt 5, termasuk menempatkannya sebelum u5 (reporting)?

- A. Setuju
- B. Ubah (sebutkan, termasuk jika ingin u5 dan u6 ditukar urutannya)
- X. Other (please specify)

[Answer]: A

### Q12. [Delivery] Bolt 6 — u5-portal-reporting

- **Definition of Done**: Daftar semua DDCL dengan judul/pembuat/tanggal/status (US5.1), filter status/tanggal dan pencarian judul (US5.2) — tampilan versi DDCL (terpisah vs dikelompokkan) mengikuti keputusan Functional Design yang sama dengan Bolt 4.
- **Confidence hypothesis**: Visibilitas historis (tujuan utama #2 produk ini) tercapai tanpa memodifikasi data DDCL yang sudah ada (query read-only murni terhadap hasil Bolt 4).
- **Expected demo**: Buka halaman rekap, filter berdasarkan status dan rentang tanggal, cari berdasarkan judul, lihat hasil yang sesuai dengan DDCL yang dibuat di Bolt sebelumnya.

Setuju untuk Bolt 6?

- A. Setuju
- B. Ubah (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
