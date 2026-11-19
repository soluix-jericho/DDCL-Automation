# Intent Capture & Framing — Questions

## Sources

- [desc] Initial description: "saya mau membuat pembuatan ddcl otomatis dengan template berikut \"C:\\\\Users\\\\solui\\\\OneDrive - PT. Soluix Finteknologi Indonesia\\\\Jericho\\\\ddcl-automation\\\\DDCL BCAS PROD 202611 - TEMPLATE.xlsx\" saya mau nanti jadi 1 monorepo saja, terkait ddclnya nanti dalam bentuk portal saya bisa mengisi semua aspek, mulai dari judul step dan objec2 intinya semuanya bisa saya isi, dan juga terkait stepnya bisa saya save juga, kalau ada stepyang sama saya tgl tambahkan dengan yang sudah ada, saya juga ingin nanti ada portal reportingnya misal saya membuat ddcl hari apa sudah dikirim hari apa isi objectnya apa saja gitu"
- [scope] Workflow-selected scope: `mvp`.

## Q1. [Produk] Apa masalah bisnis yang ingin diselesaikan dengan portal DDCL ini?

DDCL biasanya dibuat manual (misalnya di Excel) untuk setiap kebutuhan, dan isinya berulang dari dokumen ke dokumen. Apa masalah utama dari cara kerja yang sekarang yang ingin diatasi dengan portal ini?

- A. Mempercepat pembuatan DDCL dengan menghindari pengetikan ulang step/objek yang sama berulang kali
- B. Memberi riwayat/jejak (siapa membuat DDCL apa, kapan, dan statusnya) yang saat ini tidak tercatat rapi
- C. Keduanya (kecepatan pembuatan dan pencatatan riwayat)
- D. Not yet defined
- X. Other (please specify)

[Answer]: A, terkait ini agar kita mempercepat pembuatan dan bisa rekap terkait ddcl apa yang telah dibuat dan objectnya apa saja gitu

## Q2. [Produk] Siapa yang akan memakai portal ini?

- A. Hanya saya sendiri (pengguna tunggal / personal tool)
- B. Saya dan beberapa rekan tim di dalam perusahaan yang sama
- C. Banyak pengguna lintas tim/departemen
- D. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q3. [Produk] Apa itu "DDCL" di sini, dan kolom/bagian apa saja yang ada di template Excel yang Anda sebutkan?

Karena saya tidak bisa membaca langsung isi file Excel template (`DDCL BCAS PROD 202611 - TEMPLATE.xlsx`), tolong jelaskan strukturnya: apa kepanjangan DDCL, dan apa saja bagian/kolom di template itu (misalnya: judul step, deskripsi step, object/item yang diperiksa, hasil, catatan, dsb). Sebutkan setiap kolom/bagian yang menurut Anda penting untuk bisa diisi di portal.

[Answer]: Deployment Document Check List, tapi sepertinya kamu harus tetap bisa membaca karena agar 1:1 dengan templatenya

## Q4. [Produk] Apa itu "step" dan "object" dalam DDCL, dan bagaimana hubungan keduanya?

Dari deskripsi Anda, satu DDCL terdiri dari beberapa "step", dan setiap step punya "object" (atau beberapa object). Mohon jelaskan dengan contoh konkret: satu step itu seperti apa (judul + isi apa saja), dan object di dalam step itu seperti apa (contoh judul object dan isinya).

- A. Saya akan beri contoh lengkap saat mengisi file ini
- B. Not yet defined / belum bisa dijelaskan sekarang
- X. Other (please specify)

[Answer]: X, itu step implementasi jadi kamu harus tetap membaca filenya

## Q5. [Produk] Bagaimana cara kerja "simpan step" dan penggabungan step yang sama?

Anda menyebutkan: step yang pernah dibuat bisa disimpan, dan kalau ada step yang sama persis, step itu ditambahkan ke/digabungkan dengan step yang sudah ada (bukan dibuat duplikat). Apa yang membuat dua step dianggap "sama"?

- A. Judul step-nya identik (persis sama tulisannya)
- B. Judul step sama walau object di dalamnya berbeda-beda setiap DDCL
- C. Judul DAN seluruh object di dalamnya harus identik baru dianggap sama
- D. Not yet defined
- X. Other (please specify)

[Answer]: X, step itu kan langkah2 panduan jadi nanti bisa di reuse oleh ddcl lain

## Q6. [Produk] Saat step yang sama ditemukan, apa yang terjadi pada object-nya?

- A. Object baru ditambahkan ke daftar object milik step tersebut (step jadi perpustakaan/kumpulan object yang terus bertambah)
- B. Object lama ditimpa/diganti dengan object yang baru diinput
- C. Keduanya ditampilkan berdampingan, dan saya pilih mana yang dipakai di DDCL yang sedang dibuat
- D. Not yet defined
- X. Other (please specify)

[Answer]: D

## Q7. [Produk] Apa yang harus dicatat portal reporting untuk setiap DDCL yang dibuat?

Anda menyebutkan ingin tahu "DDCL dibuat hari apa, dikirim hari apa, isi objectnya apa saja". Selain itu, informasi apa lagi yang perlu ditampilkan di laporan/reporting?

- A. Tanggal dibuat, tanggal dikirim, dan daftar object/step yang dipakai saja
- B. Tambahan: status (draft/dikirim/selesai), nama/judul DDCL, dan siapa yang membuat
- C. Tambahan lain di luar A dan B (jelaskan)
- D. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q8. [Produk] "Dikirim" dalam konteks ini maksudnya bagaimana?

- A. Saya mencatat sendiri secara manual di portal bahwa DDCL ini sudah saya kirim (misalnya lewat email di luar sistem), tanpa portal benar-benar mengirim apapun
- B. Portal yang mengirimkan DDCL (misalnya lewat email) ke pihak lain secara otomatis
- C. Not yet defined
- X. Other (please specify)

[Answer]: A, tetapi nanti pilihan B di next feature

## Q9. [Produk] Keluaran akhir dari satu DDCL yang sudah selesai dibuat itu apa?

- A. File Excel/PDF yang di-generate mengikuti format template `DDCL BCAS PROD 202611 - TEMPLATE.xlsx`
- B. Cukup tersimpan sebagai data di dalam portal, tidak perlu file untuk diunduh
- C. Keduanya: tersimpan di portal, dan juga bisa diunduh sebagai file sesuai format template
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q10. [Produk] Apa yang sebaiknya TIDAK termasuk di versi pertama portal ini (`mvp`)?

Scope workflow untuk pekerjaan ini sudah dipilih sebagai `mvp` (inti produk dulu, tanpa fase operasional penuh). Dari sisi produk, fitur/aspek apa yang boleh ditunda dulu dan tidak perlu ada di versi pertama?

- A. Manajemen banyak pengguna/role (login multi-user, hak akses berjenjang) — cukup satu pengguna dulu
- B. Pengiriman email otomatis — cukup pencatatan manual "sudah dikirim" dulu
- C. Keduanya (A dan B)
- D. Not yet defined — belum ada yang perlu ditunda, semua di atas tetap perlu di versi pertama
- X. Other (please specify)

[Answer]: B

## Q11. [Produk] Konfirmasi struktur template (hasil saya membaca file Excel-nya langsung)

Saya sudah berhasil membaca langsung isi file `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (lewat script saya sendiri, karena tool bawaan hanya bisa baca teks/markdown/PDF/Word, bukan Excel). Transkrip lengkapnya saya simpan di `ddcl-template-structure.md` di folder yang sama dengan file ini. Ringkasan yang saya tangkap:

- File punya 4 sheet: **"Release Document"** (header rilis: purpose, sistem terdampak, tanggal, environment, release objectives, technical changes, change impacts, sign-off), **"Deployment Check List"** (tabel checklist utama), **"List Object & Parameter"** (daftar object per kategori), **"Checklist Capture"** (log bukti before/after per step).
- **"Step"** = satu baris "Activities" di sheet "Deployment Check List": judul singkat (mis. "Update Workflow", "Backup DB table dbbcas-prod", "Run Database Querry") + prosedur bernomor (instruksi command-line/console). Step dikelompokkan dalam fase **Pre-Implementation**, **Implementation**, **Rollback & Recovery Plan**, dan sub-grup target (Bastion, Database, RabbitMQ, dst). Tiap step juga punya kolom Date (Plan/Actual), Time (Start/End/Duration), PIC, dan Notes.
- **"Object"** = satu baris data konkret di sheet "List Object & Parameter", dikelompokkan jadi 8 kategori: 1.1 List Image, 1.2 List Update Deployment, 1.3 List Update Database Collection, 1.4 List Perubahan Configmap, 1.5 List Update Secret, 1.6 List Update Cronjob, 1.7 List Update Document, 1.8 List Update Workflow — masing-masing kategori kolomnya beda-beda (contoh: kategori Image kolomnya Deployment+Image, kategori Cronjob kolomnya Cronjob+Schedule+batchname+Secret).
- Step di sheet "Deployment Check List" merujuk ke kategori object tertentu di teks prosedurnya (mis. step "Update Deployment CES" merujuk ke kategori "1.2 List Update Deployment").

Apakah pemahaman ini sudah benar?

- A. Benar, itu persis strukturnya
- B. Sebagian besar benar, tapi ada koreksi (jelaskan di bawah)
- X. Other (please specify)

[Answer]: B, pembenarannya mungkin sekalian pada implementasinya untuk sekarang hrusnya benar semua

## Q12. [Produk] Kapan dua step dianggap "sama" agar tidak dibuat duplikat?

Dari contoh template: judul step seperti "Update Deployment CES", "Backup DB table dbbcas-prod", atau "Run Database Querry - dbbcas-prod" itu sendiri-sendiri sudah menyebut nama sistem/database spesifik di judulnya. Jadi kalau DDCL berikutnya juga perlu "Update Deployment" tapi untuk sistem/namespace yang berbeda, apakah itu dianggap:

- A. Step BARU (karena judul/konteksnya berbeda, meskipun prosedurnya mirip pola yang sama)
- B. Step YANG SAMA (karena pola prosedurnya sama), cukup object/parameternya yang beda tiap DDCL
- C. Not yet defined
- X. Other (please specify)

[Answer]: B, karena ada kemungkinan misal saya ingin menaikann image dlu baru db trus image lagi gitu

## Q13. [Produk] Saat satu step dipakai lagi di DDCL baru dengan object/parameter yang berbeda, apa yang disimpan untuk DDCL tersebut?

Misal step "Update Workflow" dipakai lagi, tapi object-nya (nama script, parameter) berbeda dari DDCL sebelumnya.

- A. Setiap DDCL menyimpan snapshot object-nya sendiri (riwayat tiap DDCL lengkap & tidak berubah walau step dipakai lagi di DDCL lain dengan object berbeda), dan daftar object milik step itu di portal terus bertambah sebagai referensi/riwayat
- B. Hanya object TERBARU yang disimpan di step tersebut (object lama tidak perlu dipertahankan)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q14. [Produk] Apakah bagian "Release Document" (header: purpose, impacted system, release objectives, sign-off) dan "Checklist Capture" (bukti screenshot before/after tiap step) juga perlu diisi lewat portal di versi pertama ini?

- A. Ya, keduanya perlu diisi juga (Release Document header + Checklist Capture evidence) supaya hasil akhirnya benar-benar 1:1 dengan template
- B. Cukup "Deployment Check List" (step + object) dan "Release Document" header saja dulu; "Checklist Capture" (upload bukti screenshot) ditunda ke versi berikutnya
- C. Cukup "Deployment Check List" (step + object) saja dulu; "Release Document" header dan "Checklist Capture" ditunda ke versi berikutnya
- D. Not yet defined
- X. Other (please specify)

[Answer]: A, yang gk urgent  checklist recap (karena jarang diisi), untk ke 3 nya itu wajib

## Q15. [Produk] Detail mekanisme reuse step, kategori object, dan rollback (koreksi atas ringkasan sebelumnya)

[Answer]: Pada tab Release Objective (Release Document), portal bisa input: Date, Start Date, Impact System, Environment, Phase / Release #, Release Objective, dan Technical Change. Judul/header tab Deployment Checklist ikut berubah mengikuti tanggal yang diisi di Release Document (contoh header "Deployment Document Check List <tanggal>").

Untuk Activities (step): satu step seperti "Update Workflow" adalah template reusable - dalam satu DDCL yang sama, step yang sama bisa dipakai berkali-kali (misal 5 kali Update Workflow di satu DDCL), dengan cara drag-and-drop atau memilih dari step yang sudah ada. Urutan/susunan activities (step mana nomor 1, 2, dst) ditentukan sendiri oleh pengguna saat menyusun DDCL. Kalau step yang dibutuhkan belum ada, pengguna isi/buat baru; kalau sudah ada template-nya, tinggal dipakai lagi.

Untuk List Object & Parameter: ada bagian untuk diisi pengguna, dan kategori object yang dipilih mengikuti/mengacu ke step sebelumnya (contoh: kalau mau "naik image gateway", pilihan kategori object yang muncul relevan dengan jenis step itu - apakah terkait database, workflow, atau kategori lain - bukan daftar object campur semua kategori).

Untuk Rollback & Recovery Plan: ini juga bagian dari Deployment Checklist (ada section/banner "Rollback & Recovery Plan" di template). Setiap step forward yang reusable itu sudah punya pasangan step rollback-nya sendiri yang juga tercatat/reusable (bukan ditulis ulang dari nol) - jadi saat menyusun DDCL, pengguna tinggal menyusun urutan step forward yang dipakai, dan step rollback-nya sudah ikut tercatat mengikuti step forward tersebut.

## Assumption Confirmation

Asumsi yang dipakai di `intent-statement.md` dan `stakeholder-map.md` karena belum ada jawaban eksplisit:

1. Decision-maker untuk prioritas/scope pekerjaan ini belum dikonfirmasi; diasumsikan pengguna utama sendiri, karena ini inisiatif internal skala kecil.
2. Kadensi/kebutuhan komunikasi pelaporan ke pihak lain di luar portal reporting ini belum didefinisikan.
3. Target metrik keberhasilan yang terukur (angka/ambang spesifik) belum ditentukan.
4. Peran dan jumlah rekan tim yang akan memakai portal ini belum dirinci (nama, jabatan, berapa orang).

- A. Accept assumptions
- B. Convert to follow-up questions

[Answer]: A. Accept assumptions

## Consolidated Summary Confirmation

- Masalah: pembuatan DDCL manual berulang, tanpa rekap terpusat (Q1).
- Pengguna: pembuat DDCL + beberapa rekan tim di perusahaan yang sama, bukan single-user, bukan lintas banyak tim (Q2).
- Struktur template dikonfirmasi: Release Document (header), Deployment Check List (step), List Object & Parameter (object, 8 kategori), Checklist Capture (bukti eksekusi) (Q3, Q11).
- Header Release Document bisa diisi pengguna: Date, Start Date, Impacted System, Environment, Phase/Release #, Release Objective, Technical Change; judul tab Deployment Checklist mengikuti tanggal yang diisi di Release Document (Q15).
- Step = judul + prosedur yang pola-nya reusable; dua step dianggap sama kalau pola prosedurnya sama walau object/parameternya beda tiap DDCL; step yang sama bisa dipakai lebih dari sekali dalam satu DDCL, urutannya ditentukan pengguna sendiri (Q5, Q12, Q15).
- Saat step dipakai ulang: tiap DDCL menyimpan snapshot object-nya sendiri, dan daftar object milik step terus bertambah sebagai riwayat/referensi; kategori object yang ditawarkan mengikuti jenis step-nya (Q13, Q15).
- Deployment Checklist juga mencakup Rollback & Recovery Plan: step forward yang reusable sudah punya pasangan step rollback yang juga reusable/tercatat (Q15).
- Reporting mencatat: tanggal dibuat, tanggal dikirim, status, judul DDCL, pembuat, dan object/step yang dipakai (Q7).
- "Dikirim" dicatat manual oleh pengguna; pengiriman email otomatis ditunda ke fitur berikutnya (Q8, Q10).
- Keluaran DDCL: tersimpan di portal dan bisa diunduh sebagai file sesuai format template (Q9).
- Versi pertama (mvp) mencakup ketiga bagian template (Release Document, Deployment Check List + List Object & Parameter, Checklist Capture) dengan Checklist Capture berprioritas lebih rendah; yang ditunda hanya pengiriman email otomatis (Q10, Q14).
- Asumsi yang diterima: decision-maker adalah pengguna sendiri; kadensi komunikasi ke pihak lain, target metrik terukur, dan rincian peran rekan tim belum didefinisikan (Assumption Confirmation).

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

## Requested Changes Feedback

[Answer]: Pada tab Release Objective (Release Document), portal bisa input: Date, Start Date, Impact System, Environment, Phase / Release #, Release Objective, dan Technical Change. Judul/header tab Deployment Checklist ikut berubah mengikuti tanggal yang diisi di Release Document (contoh header "Deployment Document Check List <tanggal>").

Untuk Activities (step): satu step seperti "Update Workflow" adalah template reusable - dalam satu DDCL yang sama, step yang sama bisa dipakai berkali-kali (misal 5 kali Update Workflow di satu DDCL), dengan cara drag-and-drop atau memilih dari step yang sudah ada. Urutan/susunan activities (step mana nomor 1, 2, dst) ditentukan sendiri oleh pengguna saat menyusun DDCL. Kalau step yang dibutuhkan belum ada, pengguna isi/buat baru; kalau sudah ada template-nya, tinggal dipakai lagi.

Untuk List Object & Parameter: ada bagian untuk diisi pengguna, dan kategori object yang dipilih mengikuti/mengacu ke step sebelumnya (contoh: kalau mau "naik image gateway", pilihan kategori object yang muncul relevan dengan jenis step itu - apakah terkait database, workflow, atau kategori lain - bukan daftar object campur semua kategori).

Untuk Rollback & Recovery Plan: ini juga bagian dari Deployment Checklist (ada section/banner "Rollback & Recovery Plan" di template). Setiap step forward yang reusable itu sudah punya pasangan step rollback-nya sendiri yang juga tercatat/reusable (bukan ditulis ulang dari nol) - jadi saat menyusun DDCL, pengguna tinggal menyusun urutan step forward yang dipakai, dan step rollback-nya sudah ikut tercatat mengikuti step forward tersebut.
