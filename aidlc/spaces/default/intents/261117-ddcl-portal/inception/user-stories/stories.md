# User Stories — Portal DDCL Otomatis

Dipecah per alur kerja (workflow), mengikuti urutan dependency-first dari `intent-backlog.md` (disepakati di `user-stories-questions.md` Q2). Persona: **Budi, Pembuat DDCL** (`personas.md`).

## Group 1: Library Step & Object (FR2)

### US1.1 — Membuat step baru di Library

Sebagai Budi, saya ingin membuat step baru lengkap dengan kategori object/parameternya, supaya step itu bisa saya pakai ulang di DDCL manapun ke depannya.

- **AC1.1.1**: Given saya sedang menyusun Deployment Checklist dan belum ada step yang cocok, When saya pilih "Buat Step Baru" dan isi nama step + kategori object, Then step baru tersimpan di Library dan langsung terpasang ke DDCL yang sedang saya susun.
- **AC1.1.2**: Given saya membuat step baru dengan nama yang sama persis dengan step yang sudah ada, When saya coba simpan, Then sistem menawarkan untuk memakai step yang sudah ada alih-alih membuat duplikat. (Dikonfirmasi sebagai keputusan produk saat review User Stories — bukan requirement eksplisit dari Requirements Analysis, tapi disepakati berguna untuk mencegah Library terisi step duplikat tak sengaja.)
- **AC1.1.3**: Given saya memilih kategori step (mis. "Database"), When form object/parameter ditampilkan, Then hanya field yang relevan dengan kategori itu yang muncul (tidak tercampur dengan kategori lain).

Prioritas: Must Have. Terkait: FR2, FR2.1, FR2.2.

### US1.2 — Melihat dampak sebelum mengubah/menghapus step

Sebagai Budi, saya ingin tahu berapa DDCL yang memakai sebuah step sebelum saya mengubah atau menghapusnya, supaya saya tidak tanpa sadar memengaruhi DDCL lain.

- **AC1.2.1**: Given saya membuka halaman Library, When daftar step ditampilkan, Then setiap step menampilkan jumlah DDCL yang memakainya.
- **AC1.2.2**: Given sebuah step dipakai di 5 DDCL, When saya coba menghapusnya, Then sistem tetap mengizinkan penghapusan, dan DDCL yang sudah memakai step itu tetap menyimpan datanya sendiri tanpa berubah.

Prioritas: Must Have. Terkait: FR2.3, FR2.4.

### US1.3 — Menetapkan pasangan rollback untuk step forward di Library

Sebagai Budi, saya ingin menetapkan step rollback pasangan saat saya membuat atau mengedit sebuah step forward di Library, supaya setiap step forward reusable selalu punya prosedur rollback yang tercatat dan bisa dipakai ulang (bukan ditulis ulang tiap kali).

- **AC1.3.1**: Given saya sedang membuat step forward baru di Library, When saya simpan step tersebut, Then saya diminta memilih step rollback yang sudah ada sebagai pasangannya, atau membuat step rollback baru langsung di alur yang sama.
- **AC1.3.2**: Given sebuah step forward di Library belum punya pasangan rollback, When step itu ditambahkan ke sebuah DDCL, Then sistem menandai di bagian Rollback & Recovery Plan bahwa pasangan rollback belum ada untuk step ini, supaya Budi sadar dan bisa melengkapinya.
- **AC1.3.3**: Given saya mengedit sebuah step forward di Library, When saya ganti pasangan rollback-nya, Then DDCL yang sudah memakai step itu sebelumnya TIDAK berubah (snapshot lama tetap), hanya DDCL baru yang memakai pasangan rollback yang baru.

Prioritas: Must Have. Terkait: FR4. Ditambahkan dari temuan review (R-01): FR4 sebelumnya hanya tertelusuri lewat sisi konsumsi otomatis (US2.3), bukan sisi pembuatan/penetapan pasangan di Library.

## Group 2: Penyusunan DDCL (FR1, FR3, FR4, FR5)

### US2.1 — Mengisi header Release Document

Sebagai Budi, saya ingin mengisi header Release Document (Date, Start Date, Impacted System, Environment, Phase/Release #, Release Objective, Technical Change) untuk DDCL baru, supaya informasi rilis tercatat lengkap sejak awal.

- **AC2.1.1**: Given saya membuat DDCL baru, When saya isi semua field header dan simpan, Then DDCL tersimpan sebagai draft dengan judul tab Deployment Checklist mengikuti tanggal yang saya isi.
- **AC2.1.2**: Given saya belum mengisi field wajib, When saya coba lanjut ke langkah berikutnya, Then sistem menampilkan pesan yang menyebutkan field mana yang masih kosong, dan data yang sudah saya isi tidak hilang.

Prioritas: Must Have. Terkait: FR1, FR1.1.

### US2.2 — Menyusun Deployment Checklist dari step reusable

Sebagai Budi, saya ingin menambahkan step dari Library ke DDCL yang sedang saya susun, mengisi object/parameter-nya, dan mengatur urutannya sendiri, supaya saya tidak menulis ulang step yang polanya sudah sama dari DDCL sebelumnya.

- **AC2.2.1**: Given saya sedang menyusun Deployment Checklist, When saya tambahkan sebuah step dari Library, Then step itu muncul di daftar checklist dengan field object/parameter sesuai kategorinya, siap diisi nilainya.
- **AC2.2.2**: Given saya sudah menambahkan beberapa step, When saya ubah urutannya, Then urutan baru tersimpan dan tercermin saat DDCL dibuka kembali.
- **AC2.2.3**: Given saya perlu step yang sama dua kali dalam satu DDCL (mis. backup database untuk dua environment berbeda), When saya tambahkan step itu lagi, Then step muncul sebagai baris terpisah dengan object/parameter masing-masing.

Prioritas: Must Have. Terkait: FR3, FR3.1, FR3.2, FR3.3.

### US2.3 — Rollback plan otomatis terpasang

Sebagai Budi, saya ingin prosedur rollback otomatis muncul saat saya menambahkan sebuah step forward, supaya saya tidak perlu menulis ulang prosedur rollback dari nol setiap kali.

- **AC2.3.1**: Given saya menambahkan step forward yang punya pasangan rollback di Library, When step itu masuk ke checklist, Then rollback pasangannya otomatis muncul di bagian Rollback & Recovery Plan DDCL ini.

Prioritas: Must Have. Terkait: FR4, FR4.1.

### US2.4 — Mencatat bukti eksekusi (Checklist Capture)

Sebagai Budi, saya ingin mencatat bukti eksekusi sederhana per step, supaya ada jejak pelaksanaan meski saya tidak selalu mengisinya secara detail.

- **AC2.4.1**: Given sebuah DDCL sudah punya checklist, When saya buka bagian Checklist Capture, Then saya bisa mengisi catatan eksekusi per step secara opsional (boleh dikosongkan tanpa menghalangi saya lanjut ke langkah berikutnya).

Prioritas: Must Have (versi sederhana). Terkait: FR5. Catatan: field minimum Checklist Capture (`R-02` dari review Requirements Analysis) akan dirinci di Functional Design.

## Group 3: Status & Versi DDCL (FR6)

### US3.1 — Menandai DDCL sebagai sudah dikirim

Sebagai Budi, saya ingin menandai sebuah DDCL sebagai "Sudah Dikirim" setelah saya mengirimkannya ke klien, supaya rekap portal mencatat status dan tanggal pengirimannya secara manual.

- **AC3.1.1**: Given sebuah DDCL berstatus Draft, When saya tandai sebagai "Sudah Dikirim", Then status dan tanggal kirim tercatat, dan DDCL tersebut menjadi read-only (tidak bisa diedit langsung lagi).

Prioritas: Must Have. Terkait: FR6, FR6.1, FR6.3.

### US3.2 — Membuat revisi dari DDCL yang sudah dikirim

Sebagai Budi, saya ingin membuat versi baru dari DDCL yang sudah terkirim ketika ternyata perlu revisi, supaya saya tidak kehilangan riwayat DDCL asli dan tetap bisa melacak hubungan antar versi.

- **AC3.2.1**: Given sebuah DDCL berstatus "Sudah Dikirim" bernama "DDCL BCAS PROD 202611", When saya pilih "Buat Revisi", Then sistem membuat DDCL baru berstatus Draft bernama "DDCL BCAS PROD 202611 v2" yang terhubung ke DDCL asalnya dan bisa saya edit.
- **AC3.2.2**: Given DDCL v2 di atas juga sudah "Sudah Dikirim" dan perlu direvisi lagi, When saya pilih "Buat Revisi" dari v2, Then sistem membuat "DDCL BCAS PROD 202611 v3" yang terhubung ke v2.

Prioritas: Must Have. Terkait: FR6.2.

## Group 4: Ekspor Excel (FR7)

### US4.1 — Mengunduh DDCL sebagai file Excel

Sebagai Budi, saya ingin mengunduh DDCL yang sudah saya susun sebagai file Excel yang formatnya sama persis dengan template perusahaan, supaya saya bisa langsung mengirimkannya ke klien tanpa menyusun ulang secara manual.

- **AC4.1.1**: Given sebuah DDCL sudah lengkap diisi, When saya klik "Unduh Excel", Then file yang dihasilkan mengikuti tata letak `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (sheet, kolom, pengelompokan baris per fase) dengan data header, checklist, rollback, dan capture terisi sesuai DDCL tersebut.
- **AC4.1.2**: Given data operasional (host, database, image) ada di dalam DDCL, When file Excel dihasilkan, Then data tersebut tampil apa adanya tanpa disamarkan (sesuai kebutuhan pengiriman ke klien).
- **AC4.1.3**: Given DDCL belum lengkap diisi (mis. header masih kosong atau belum ada step sama sekali), When saya klik "Unduh Excel", Then sistem menolak dengan pesan yang menyebutkan bagian mana yang masih kurang, dan tidak menghasilkan file yang setengah jadi.
- **AC4.1.4**: Given jumlah step dalam satu DDCL melebihi jumlah baris yang disediakan template asli untuk satu fase, When file Excel dihasilkan, Then sistem tetap menghasilkan file yang valid (baris tambahan mengikuti format yang sama) tanpa merusak tata letak fase lain, dan memberi tahu Budi bahwa jumlah step di fase itu di luar kebiasaan.
- **AC4.1.5**: Given nilai object/parameter mengandung karakter yang berpotensi merusak format sel Excel (mis. formula-like text yang diawali `=`, atau baris baru di dalam satu sel), When file Excel dihasilkan, Then karakter tersebut ditulis sebagai teks biasa apa adanya (tidak dieksekusi sebagai formula) dan tidak merusak struktur sel di sekitarnya.

Prioritas: Must Have. Terkait: FR7, FR7.1, NFR6. AC4.1.3–AC4.1.5 ditambahkan dari temuan review (R-02): fitur ini ditandai sebagai risiko teknis utama di `requirements.md`, sehingga perlu kriteria kasus gagal/tepi, bukan hanya jalur sukses.

## Group 5: Portal Reporting (FR8)

### US5.1 — Melihat rekap semua DDCL

Sebagai Budi, saya ingin melihat rekap semua DDCL yang pernah saya buat beserta statusnya, supaya saya tahu DDCL mana yang sudah dikirim dan mana yang masih draft tanpa harus membuka satu per satu.

- **AC5.1.1**: Given saya membuka Dashboard, When halaman dimuat, Then saya melihat daftar DDCL dengan judul, pembuat, tanggal dibuat, tanggal dikirim, dan status.
- **AC5.1.2**: Given saya belum pernah membuat DDCL apapun, When saya membuka Dashboard, Then saya melihat pesan bahwa belum ada DDCL dengan tombol untuk membuat yang pertama.

Prioritas: Must Have. Terkait: FR8.

### US5.2 — Memfilter dan mencari rekap DDCL

Sebagai Budi, saya ingin memfilter rekap berdasarkan status/tanggal dan mencari berdasarkan judul, supaya saya cepat menemukan DDCL tertentu di antara banyak DDCL yang sudah dibuat.

- **AC5.2.1**: Given rekap memuat puluhan DDCL, When saya ketik sebagian judul di kolom pencarian, Then daftar yang tampil hanya DDCL yang judulnya cocok.
- **AC5.2.2**: Given saya memilih filter status "Sudah Dikirim", When filter diterapkan, Then hanya DDCL dengan status itu yang tampil.

Prioritas: Should Have. Terkait: FR8.1.

## Group 6: Multi-Pengguna & Konkurensi (FR9, FR10)

### US6.1 — Mencegah dua pengguna mengedit DDCL yang sama secara bersamaan

Sebagai Budi, saya ingin DDCL yang sedang saya edit terkunci dari pengguna lain, supaya perubahan kami berdua tidak saling menimpa tanpa disadari.

- **AC6.1.1**: Given sebuah DDCL sedang saya edit, When pengguna lain membuka DDCL yang sama, Then mereka melihatnya dalam mode baca saja dan diberi tahu bahwa DDCL sedang diedit oleh saya.
- **AC6.1.2**: Given saya mengunci DDCL untuk diedit lalu meninggalkan sesi tanpa menutup dengan benar, When sudah melewati batas waktu tidak aktif, Then kunci otomatis dilepas sehingga pengguna lain bisa mengeditnya.

Prioritas: Must Have. Terkait: FR10, FR10.1.

### US6.2 — Mendukung lebih dari satu akun pengguna

Sebagai Budi, saya ingin rekan tim saya juga bisa punya akun sendiri di portal ini, supaya ke depannya kami bisa memakai portal yang sama tanpa berbagi satu akun.

- **AC6.2.1**: Given portal sudah berjalan, When ditambahkan akun pengguna baru, Then pengguna baru itu bisa login dan memakai seluruh fitur portal (membuat DDCL, mengelola Library, melihat rekap) seperti pengguna lainnya.

Prioritas: Must Have (kapabilitas, bukan intensitas pemakaian). Terkait: FR9.

## Ringkasan Prioritas (MoSCoW)

| Prioritas | Jumlah Story | Story |
|---|---|---|
| Must Have | 12 | US1.1, US1.2, US2.1, US2.2, US2.3, US2.4, US3.1, US3.2, US4.1, US5.1, US6.1, US6.2 |
| Should Have | 1 | US5.2 |
| Could Have | 0 | — |
| Won't Have | 0 | — |

Batas MVP formal akan diputuskan di Delivery Planning; prioritas di atas adalah masukan untuk keputusan itu, bukan keputusan final.
