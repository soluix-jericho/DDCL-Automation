# Feasibility Assessment — Portal DDCL Otomatis

## Ringkasan

Berdasarkan `intent-statement.md` (tahap Intent Capture & Framing), pekerjaan ini membangun portal internal untuk menyusun DDCL (Deployment Document Check List) dari step dan object yang bisa dipakai ulang, plus portal reporting. Penilaian ini menyimpulkan pekerjaan **layak secara teknis** untuk scope `mvp`, dengan risiko utama pada ketepatan hasil ekspor (harus 1:1 dengan format template Excel) dan pada desain data model reusable step/object/rollback, bukan pada kompleksitas infrastruktur.

## Technical Viability

- **Tidak ada integrasi sistem eksternal di versi pertama** [Q1]: seluruh data step dan object diketik manual oleh pengguna di portal; integrasi otomatis ke sistem lain (mis. ambil versi image langsung dari registry) ditunda ke versi berikutnya. Ini menyederhanakan v1 secara signifikan — tidak perlu kredensial/API pihak ketiga di awal.
- **Data operasional (host, database, image, dsb.) disimpan apa adanya di database portal, dan harus tetap tampil penuh saat diekspor ke Excel** karena file itu dikirim ke klien/pihak lain [Q2]. Artinya tidak diperlukan masking/enkripsi field di level tampilan — tapi penyimpanan tetap perlu praktik keamanan standar (akses dibatasi ke pengguna yang berwenang, koneksi database terenkripsi) karena isinya adalah data infrastruktur produksi milik perusahaan.
- **Deployment awal cukup lokal via Docker** [Q4]; arah hosting jangka panjang (mis. ke infrastruktur Kubernetes/AWS yang sama seperti yang tercatat di template) belum ditentukan. Ini berarti arsitektur v1 harus mudah di-containerize dan tidak boleh berasumsi tentang platform hosting produksi tertentu.
- **Keluaran akhir DDCL harus bisa diunduh sebagai file yang mengikuti format template Excel asli** (per `intent-statement.md`). Ini adalah risiko teknis utama: menghasilkan file Excel yang tata letaknya (sheet, kolom, pengelompokan baris per fase) sama persis dengan `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` memerlukan pustaka generate-Excel yang bisa mengisi template yang sudah ada (bukan sekadar menulis tabel baru), bukan tugas yang sepele tapi sudah terbukti umum dikerjakan (pustaka penulisan Excel berbasis template tersedia di hampir semua platform modern).
- **Tidak ada batasan anggaran/waktu yang ketat** [Q5], dan **tidak ada hambatan organisasi yang diketahui** [Q6] — ini menurunkan risiko pengiriman (delivery risk) pekerjaan ini.

## Technology Recommendation

Preferensi teknologi awalnya diserahkan ke rekomendasi terbaik dari sisi kecepatan dan kemudahan perawatan [Q3]; setelah didiskusikan, pengguna menegaskan backend dan frontend harus tetap dua app terpisah (bukan digabung) supaya mudah dikembangkan lebih lanjut, dan bahasa backend diserahkan ke rekomendasi arsitek (lihat `feasibility-questions.md` bagian Requested Changes Feedback). Pekerjaan ini tetap satu **monorepo** [Q1 intent-capture] yang membungkus app-app terpisah tersebut:

- **Struktur monorepo**: app frontend dan app backend terpisah (folder/package berbeda), masing-masing bisa dikembangkan dan di-deploy secara independen ke depannya, tetap dalam satu repository Git.
- **Frontend**: TypeScript.
- **Backend**: Node.js/TypeScript — direkomendasikan karena beban kerja portal ini ringan (CRUD + sesekali generate Excel, bukan sistem berkecepatan eksekusi tinggi), sehingga "tercepat" yang relevan adalah tercepat dibangun & dirawat oleh satu orang/tim kecil; ekosistem Node.js/TypeScript juga punya pustaka pengisian Excel-template yang jauh lebih matang dibanding alternatif seperti Rust, dan berbagi bahasa dengan frontend memudahkan berbagi definisi data (struktur step/object) tanpa menulis dua kali.
- **Database**: PostgreSQL (relasional cocok untuk data step/object yang saling berelasi dan riwayat per DDCL yang terus bertambah), dijalankan via Docker untuk tahap lokal [Q4].
- **Pembuatan file Excel sesuai template**: pustaka penulisan Excel yang mendukung pengisian ke dalam file template yang sudah ada (menjaga format, warna, dan tata letak asli), bukan menulis spreadsheet baru dari nol.
- Pilihan kerangka kerja dan pustaka spesifik (bukan sekadar bahasa/platform/struktur app) adalah keputusan arsitektur dan akan dicatat sebagai ADR di tahap Domain Design, bukan di tahap ini.

## Risk Analysis

| Risiko | Dampak | Mitigasi awal |
|---|---|---|
| Hasil ekspor Excel tidak 1:1 dengan template asli (tata letak, pengelompokan baris per fase, format sel) | Tinggi — ini salah satu syarat utama yang dikonfirmasi pengguna | Pilih pustaka yang mengisi ke template yang ada, uji ekspor terhadap `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` sejak awal Construction |
| Model data step/object/rollback reusable (dari `intent-statement.md`) kompleks untuk dirancang dengan benar sejak awal | Sedang — salah desain di awal mahal diubah belakangan | Didesain eksplisit di tahap Domain Design sebelum Code Generation |
| Arah hosting jangka panjang belum diketahui [Q4] | Rendah untuk v1 (cukup lokal), tapi bisa jadi kerja ulang nanti | Hindari keputusan arsitektur yang mengunci ke satu platform hosting tertentu di v1 |

## Assumptions & Open Questions

Tidak ada asumsi baru di tahap ini di luar yang sudah dicatat di `intent-statement.md`; semua pertanyaan kelayakan pada tahap ini sudah terjawab (lihat `feasibility-questions.md`).
