# Requirements Analysis — Questions

## Sources

- [desc] Initial description: "saya mau membuat pembuatan ddcl otomatis dengan template berikut \"C:\\\\Users\\\\solui\\\\OneDrive - PT. Soluix Finteknologi Indonesia\\\\Jericho\\\\ddcl-automation\\\\DDCL BCAS PROD 202611 - TEMPLATE.xlsx\" saya mau nanti jadi 1 monorepo saja, terkait ddclnya nanti dalam bentuk portal saya bisa mengisi semua aspek, mulai dari judul step dan objec2 intinya semuanya bisa saya isi, dan juga terkait stepnya bisa saya save juga, kalau ada stepyang sama saya tgl tambahkan dengan yang sudah ada, saya juga ingin nanti ada portal reportingnya misal saya membuat ddcl hari apa sudah dikirim hari apa isi objectnya apa saja gitu"
- [scope] Workflow-selected scope: `mvp`.
- [memory] `scope-document.md`, `intent-backlog.md` (Scope Definition).
- [memory] `wireframes.md`, `user-flow.md` (Rough Mockups) — termasuk 3 temuan review terbuka (R-01, R-02, R-03) yang perlu dikonfirmasi di tahap ini.
- [memory] `team-practices.md` (Practices Discovery) — test-after, walking skeleton, deploy lokal Docker Compose.

## Q1. [Fungsional] Apakah DDCL yang sudah berstatus "Sudah Dikirim" boleh diedit kembali?

Ini temuan terbuka dari review Rough Mockups (R-01): `user-flow.md` mengasumsikan DDCL yang sudah dikirim jadi read-only, tapi ini belum pernah dikonfirmasi.

- A. Tidak boleh diedit lagi setelah berstatus "Sudah Dikirim" (read-only); untuk revisi, pengguna membuat DDCL baru
- B. Tetap boleh diedit kapan saja, termasuk setelah berstatus "Sudah Dikirim"
- C. Boleh diedit, tapi ada riwayat perubahan (log) setelah berstatus "Sudah Dikirim"
- X. Other (please specify)

[Answer]: A, tapi nanti misal ada tambahan misal step atau object yang kurang nanti mengacu pada ddcl itu

### Klarifikasi Q1

DDCL asli yang sudah "Sudah Dikirim" tetap read-only/tidak berubah. Kalau ternyata perlu revisi, pengguna klik DDCL tersebut untuk membuat versi baru (v2) yang namanya otomatis menjadi "<nama DDCL asli> v2", terhubung/mereferensikan ke DDCL asal (bukan DDCL yang berdiri sendiri tanpa hubungan). Versi v2 ini mulai dari draft (bisa diedit) dan mengikuti siklus status yang sama (draft → sudah dikirim → read-only, lalu bisa dibuat v3 dari v2 jika diperlukan lagi, dst).

## Q2. [Fungsional] Bagaimana jika dua pengguna mengedit DDCL yang sama secara bersamaan?

Temuan terbuka dari review Rough Mockups (R-02): multi-pengguna adalah kapabilitas inti MVP, tapi penanganan edit bersamaan belum ditentukan.

- A. Tidak perlu penanganan khusus untuk MVP — risiko kecil karena tim kecil, siapa yang simpan terakhir yang menang (last write wins)
- B. Kunci (lock) DDCL saat sedang diedit satu pengguna; pengguna lain hanya bisa melihat sampai lock dilepas
- X. Other (please specify)

[Answer]: B

## Q3. [Fungsional] Apakah kolom "jumlah DDCL yang memakai step ini" di Library perlu ada di MVP?

Temuan terbuka dari review Rough Mockups (R-03): wireframe menambahkan data ini, belum tercatat di scope sebelumnya.

- A. Ya, berguna agar pengguna tahu dampak sebelum mengubah/menghapus sebuah step
- B. Tidak perlu untuk MVP, bisa dihapus dari wireframe
- X. Other (please specify)

[Answer]: A

## Q4. [Fungsional] Siapa yang boleh mengedit atau menghapus sebuah DDCL?

- A. Siapapun pengguna yang login bisa mengedit/menghapus DDCL siapapun (tim kecil, saling percaya)
- B. Hanya pembuat DDCL yang bisa mengedit/menghapus DDCL miliknya sendiri
- X. Other (please specify)

[Answer]: X, untuk sekarang usernya hanya saya saja

## Q5. [Fungsional] Apa yang terjadi kalau sebuah step di Library dihapus, padahal masih dipakai di satu atau lebih DDCL yang sudah ada?

- A. Step tidak boleh dihapus selama masih dipakai di DDCL manapun (sistem menolak dan memberi tahu alasannya)
- B. Step tetap bisa dihapus; DDCL yang sudah memakainya tetap menyimpan datanya sendiri (step di Library hanya hilang untuk DDCL baru)
- X. Other (please specify)

[Answer]: B

## Q6. [Non-Fungsional] Berapa banyak pengguna dan DDCL yang perlu didukung sistem di v1?

Dibutuhkan untuk menentukan target performa yang realistis (jumlah pengguna bersamaan, volume data).

- A. Skala kecil — di bawah 20 pengguna aktif, ratusan DDCL per tahun; tidak perlu target performa khusus, cukup responsif untuk pemakaian normal (interaksi di bawah 2 detik)
- B. Ada perkiraan skala yang berbeda (sebutkan jumlah pengguna/DDCL yang diperkirakan)
- X. Other (please specify)

[Answer]: A

## Q7. [Non-Fungsional] Apakah ada kebutuhan backup/retensi data yang perlu diperhatikan?

Data DDCL berisi informasi operasional produksi yang dikirim ke klien dan dipakai sebagai rekaman historis.

- A. Data disimpan permanen (tidak ada penghapusan otomatis); backup rutin database adalah tanggung jawab operasional biasa, tidak perlu fitur retensi khusus di aplikasi
- B. Ada kebutuhan retensi/penghapusan data tertentu (sebutkan)
- X. Other (please specify)

[Answer]: A, tapi nanti di masa depan dipikirkan kembali apakah ada housekeepingnya

## Consolidated Summary Confirmation

- DDCL berstatus "Sudah Dikirim" bersifat read-only. Revisi dibuat dengan membuka DDCL tersebut dan membuat versi baru (v2, v3, dst.) bernama "<nama DDCL asli> vN", terhubung ke DDCL asal; versi baru mulai dari draft dan mengikuti siklus status yang sama (Q1).
- Dua pengguna mengedit DDCL yang sama: dikunci (lock) saat sedang diedit satu pengguna; pengguna lain hanya bisa melihat sampai lock dilepas (Q2).
- Library Step & Object menampilkan jumlah DDCL yang memakai tiap step, agar pengguna tahu dampak sebelum mengubah/menghapus step (Q3).
- Untuk v1, hanya ada satu pengguna (pembuat DDCL sendiri); model otorisasi multi-pengguna yang lebih ketat (siapa boleh edit DDCL siapa) belum perlu diputuskan sekarang — portal tetap mendukung banyak akun secara teknis sesuai scope, tapi aturan kepemilikan/izin antar-pengguna ditunda sampai benar-benar dipakai multi-pengguna (Q4).
- Step di Library tetap bisa dihapus meski sedang dipakai; DDCL yang sudah memakainya menyimpan datanya sendiri (tidak terpengaruh saat step dihapus dari Library) (Q5).
- Skala v1: di bawah 20 pengguna aktif, ratusan DDCL per tahun; tidak ada target performa khusus di luar responsif untuk pemakaian normal (Q6).
- Data DDCL disimpan permanen untuk v1 (tidak ada penghapusan/retensi otomatis); kebutuhan housekeeping data dipertimbangkan ulang di masa depan (Q7).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
