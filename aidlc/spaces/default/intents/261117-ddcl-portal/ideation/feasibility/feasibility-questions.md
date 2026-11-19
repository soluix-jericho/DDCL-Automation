# Feasibility & Constraints — Questions

## Sources

- [desc] Initial description: "saya mau membuat pembuatan ddcl otomatis dengan template berikut \"C:\\\\Users\\\\solui\\\\OneDrive - PT. Soluix Finteknologi Indonesia\\\\Jericho\\\\ddcl-automation\\\\DDCL BCAS PROD 202611 - TEMPLATE.xlsx\" saya mau nanti jadi 1 monorepo saja, terkait ddclnya nanti dalam bentuk portal saya bisa mengisi semua aspek, mulai dari judul step dan objec2 intinya semuanya bisa saya isi, dan juga terkait stepnya bisa saya save juga, kalau ada stepyang sama saya tgl tambahkan dengan yang sudah ada, saya juga ingin nanti ada portal reportingnya misal saya membuat ddcl hari apa sudah dikirim hari apa isi objectnya apa saja gitu"
- [scope] Workflow-selected scope: `mvp`.
- [Q1] `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/intent-capture/intent-capture-questions.md`: "saya mau nanti jadi 1 monorepo saja" (satu monorepo untuk portal + reporting).

## Q1. [Teknis] Sistem apa saja yang perlu portal ini "tahu" atau integrasikan?

Dari isi template DDCL, DDCL berisi data operasional nyata (nama host, nama database, nama image Docker, namespace Kubernetes, dsb). Apakah portal ini perlu terhubung ke sistem lain secara langsung (misalnya ambil data otomatis dari suatu sistem), atau pengguna yang mengetik semuanya secara manual ke portal?

- A. Murni manual — pengguna mengetik semua data step/object ke portal, tidak ada integrasi ke sistem lain
- B. Ada rencana integrasi ke sistem lain di masa depan, tapi tidak untuk versi pertama ini
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Keamanan/Kepatuhan] Apakah ada data sensitif yang perlu diperlakukan khusus?

Contoh dari template: alamat host SSH, nama database production, kredensial (meski kebanyakan dikosongkan), path internal perusahaan. Apakah ada data semacam ini yang kalau tersimpan di portal perlu perlindungan khusus (misalnya tidak boleh terlihat semua orang, atau tidak boleh disimpan sama sekali)?

- A. Boleh disimpan apa adanya seperti di template Excel (tidak ada aturan khusus, akses sudah terbatas ke tim internal)
- B. Ada beberapa field yang sensitif (misalnya kredensial/secret) dan sebaiknya tidak disimpan sebagai teks biasa, atau disamarkan
- C. Not yet defined
- X. Other (please specify)

[Answer]: X, mungkin kalau bisa akan disimpan didalam DB tapi di excel akan di munculkan karena akan dikirim ke client juga

## Q3. [Teknis] Apa preferensi teknologi/platform untuk membangun portal ini?

- A. Tidak ada preferensi khusus — silakan pilih yang paling umum/mudah dirawat
- B. Ada preferensi (jelaskan: bahasa pemrograman, framework, atau platform hosting tertentu)
- X. Other (please specify)

[Answer]: X, sarankan yang terbaik misal kecepatan kemudahan dll

## Q4. [Teknis] Di mana portal ini akan dijalankan/di-hosting?

- A. Di infrastruktur perusahaan yang sudah ada (mis. Kubernetes/AWS yang sama seperti yang tercatat di template DDCL)
- B. Cukup dijalankan secara lokal di komputer sendiri (belum perlu di-deploy ke server)
- C. Belum tahu / Not yet defined
- X. Other (please specify)

[Answer]: X, untuk sekarang saya akan deploy dilocal dulu (docker) untuk kedepannya belum tahu

## Q5. [Produk] Apakah ada batasan waktu atau anggaran untuk pekerjaan ini?

- A. Tidak ada batasan waktu/anggaran yang ketat — ini inisiatif internal yang fleksibel
- B. Ada target waktu tertentu (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q6. [Produk] Apakah ada hal lain yang bisa menghambat pekerjaan ini (mis. prioritas lain yang lebih mendesak, atau kebijakan perusahaan yang membatasi)?

- A. Tidak ada hambatan organisasi yang diketahui saat ini
- B. Ada hambatan (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Tidak ada integrasi otomatis ke sistem lain di v1; semua step/object diketik manual (Q1).
- Data operasional (host, database, image, dsb.) disimpan apa adanya di database; saat diekspor ke Excel untuk dikirim ke klien, data tetap tampil penuh tanpa masking (Q2).
- Teknologi: monorepo berisi app frontend dan app backend yang TERPISAH (bukan digabung), supaya mudah dikembangkan lebih lanjut. Frontend TypeScript; backend Node.js/TypeScript (direkomendasikan setelah membahas Rust, karena beban kerja portal ini ringan sehingga "tercepat" yang relevan adalah cepat dibangun & dirawat, bukan cepat dieksekusi). Database PostgreSQL via Docker. Pembuatan file Excel pakai pustaka berbasis template agar hasil ekspor 1:1 dengan `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (Q3, dan diskusi lanjutan).
- Deployment awal cukup lokal via Docker; arah hosting jangka panjang belum ditentukan (Q4).
- Tidak ada batasan waktu/anggaran yang ketat (Q5), dan tidak ada hambatan organisasi yang diketahui (Q6).
- Risiko utama: ketepatan format ekspor Excel, dan desain model data step/object/rollback reusable — keduanya dicatat untuk ditangani di tahap Domain Design/Construction, bukan diputuskan sekarang.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

## Requested Changes Feedback

[Answer]: Backend dan frontend harus tetap dua bagian terpisah (app berbeda) di dalam satu monorepo, bukan digabung jadi satu aplikasi — supaya mudah dikembangkan lebih lanjut ke depannya. Untuk pilihan bahasa backend, ditanyakan apakah Rust (demi kecepatan); setelah dijelaskan bahwa beban kerja portal ini ringan (CRUD + sesekali generate Excel, bukan sistem berkecepatan tinggi) sehingga "cepat" yang relevan adalah cepat dibangun & dirawat, bukan cepat dieksekusi, dan Rust punya ekosistem pengisian Excel-template yang jauh lebih sedikit dibanding Node.js/TypeScript, pilihan bahasa backend diserahkan ke rekomendasi saya. Keputusan: backend Node.js/TypeScript (app terpisah dari frontend), frontend TypeScript — keduanya hidup sebagai app/package terpisah dalam satu monorepo.
