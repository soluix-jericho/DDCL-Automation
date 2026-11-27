# Functional Design — u4-user-accounts — Business Rules

Sumber: `requirements.md` (FR9, NFR2), `stories.md` (US6.2/AC6.2.1), jawaban `functional-design-questions.md` Q1–Q14 (Q12–Q14 dari putaran revisi setelah NFR Requirements; perbaikan temuan review R-03 sampai R-10), `aidlc/spaces/default/memory/phases/construction.md` ## Error Handling, ## Security. Aturan Unit sebelumnya tetap berlaku; BR4.8 menambah syarat sesi pada semua endpoint U1–U3.

```yaml
rules:
  - id: BR4.1
    statement: Email adalah identitas login; dinormalisasi dan unik di seluruh akun, termasuk akun nonaktif.
    category: validation
    applies_to: User
    trigger: Permintaan membuat akun (bootstrap atau oleh admin) dan permintaan login
    logic: "IF email setelah spasi ujung dibuang dan diubah ke huruf kecil kosong, lebih dari 254 karakter, atau bukan bentuk alamat email yang sah (satu @, bagian lokal dan domain tidak kosong, tanpa spasi) THEN tolak dengan 400. IF sudah ada User dengan email yang sama (termasuk yang inactive) THEN tolak dengan 409. Login mencari User dengan email yang dinormalisasi dengan cara yang sama"
    violation_behaviour: Pembuatan akun ditolak 400 atau 409; tidak ada akun tersimpan.
    source: FR9, AC6.2.1, Q1

  - id: BR4.2
    statement: Kata sandi minimal 10 karakter, disimpan hanya sebagai hash scrypt dengan garam acak, dan dibandingkan dengan perbandingan waktu-konstan (keputusan manusia Q2: scrypt, tanpa dependensi baru).
    category: validation
    applies_to: User
    trigger: Membuat akun, mengganti kata sandi, dan login
    logic: "IF kata sandi baru kurang dari 10 karakter atau lebih dari 128 karakter THEN tolak dengan 400. Tidak ada aturan kompleksitas lain. Hash dihitung dengan scrypt memakai garam acak per akun; kata sandi mentah tidak pernah disimpan, dicatat di log atau audit, atau dikembalikan di respons. Verifikasi membandingkan hash dengan perbandingan waktu-konstan. IF email tidak terdaftar THEN tetap hitung satu hash tiruan sebelum menjawab supaya waktu respons tidak membedakan email ada atau tidak"
    violation_behaviour: Kata sandi yang tidak memenuhi syarat ditolak 400 dengan pesan batas panjang; tidak ada perubahan tersimpan.
    source: Q2; phases/construction.md ## Security (tanpa kredensial hardcode, validasi input)

  - id: BR4.3
    statement: Login hanya berhasil untuk akun aktif dengan kata sandi benar; semua kegagalan memberi jawaban generik yang sama.
    category: authorization
    applies_to: User, Session
    trigger: POST /api/v1/auth/login
    logic: "IF email tidak terdaftar ATAU kata sandi salah ATAU status akun inactive THEN jawab 401 dengan pesan generik yang sama (tidak membedakan sebabnya). IF akun aktif dan kata sandi benar THEN terbitkan sesi sesuai BR4.5, kosongkan LoginThrottle email itu, isi lastLoginAt, dan jawab 200 dengan sessionToken dan user (id, name, email, role)"
    violation_behaviour: 401 generik; tidak ada sesi diterbitkan.
    source: AC6.2.1, FR9, Q3, Q4

  - id: BR4.4
    statement: Lima percobaan gagal beruntun (login atau kata sandi lama pada ganti kata sandi) untuk satu email mengunci email itu selama 15 menit; admin bisa membukanya lebih awal.
    category: constraint
    applies_to: LoginThrottle
    trigger: POST /api/v1/auth/login
    logic: "IF LoginThrottle email itu punya lockedUntil di masa depan THEN jawab 429 dengan pesan generik dan header Retry-After tanpa memeriksa kata sandi (berlaku sama untuk email yang tidak terdaftar, dan untuk login maupun ganti kata sandi). IF login gagal (BR4.3) atau kata sandi lama salah pada ganti kata sandi (BR4.12) THEN failedCount naik satu; IF failedCount mencapai 5 THEN lockedUntil diisi sekarang + 15 menit dan failedCount diatur ulang ke 0. IF login berhasil THEN baris LoginThrottle email itu dikosongkan. Penghitung dan kunci ditulis dalam satu transaksi dengan pengecekan agar permintaan paralel tidak melewati batas 5. Kunci habis otomatis setelah 15 menit atau dibuka admin (BR4.18); penguncian dan pembukaan dicatat sebagai AuditEvent (BR4.20)"
    violation_behaviour: 429 selama terkunci.
    source: Q4, NFR2, NFR Requirements Q4 (kata sandi lama), review R-02

  - id: BR4.5
    statement: Sesi dibawa cookie httpOnly atau header Authorization Bearer berisi token acak 256 bit yang hanya disimpan sebagai hash.
    category: policy
    applies_to: Session
    trigger: Login berhasil
    logic: "Token = 32 byte acak dari generator kriptografis, dikodekan teks. Database menyimpan SHA-256 token sebagai tokenHash. Cookie ddcl_session diset httpOnly, SameSite=Lax, path /, dengan atribut Secure ditentukan oleh konfigurasi COOKIE_SECURE (bawaan nonaktif untuk Docker Compose lokal, aktif bila dilayani lewat HTTPS); tanpa Max-Age (cookie sesi browser) karena masa berlaku ditegakkan server (BR4.6). Token yang sama juga ada di badan respons login sebagai sessionToken sesuai kontrak dan boleh dikirim klien sebagai Authorization: Bearer <sessionToken> (NFR Requirements Q7 B; pembawa kedua setara cookie, lihat BR4.8). Satu pengguna boleh punya banyak sesi bersamaan. IF permintaan login membawa sesi valid milik siapa pun THEN sesi lama itu dicabut saat sesi baru diterbitkan"
    violation_behaviour: Tidak berlaku (aturan penerbitan).
    source: Q3, AC6.2.1, NFR Requirements Q7, review R-08, R-10

  - id: BR4.6
    statement: Sesi berlaku 8 jam sejak aktivitas terakhir dengan batas mutlak 7 hari sejak login.
    category: constraint
    applies_to: Session
    trigger: Setiap permintaan ke endpoint yang mewajibkan sesi
    logic: "Token dibaca dari header Authorization Bearer; bila tidak ada, dari cookie ddcl_session (bila keduanya ada, Bearer dipakai, Q14). IF tidak ada token atau tokenHash tidak ditemukan ATAU revokedAt terisi ATAU sekarang - lastSeenAt > 8 jam ATAU sekarang - createdAt > 7 hari ATAU User berstatus inactive THEN permintaan dianggap tanpa sesi valid (BR4.8). IF valid THEN lastSeenAt digeser ke sekarang; penulisan ini dibatasi paling cepat sekali per menit per sesi agar tidak menambah beban tulis pada tiap permintaan"
    violation_behaviour: 401; sesi yang kedaluwarsa tidak pernah hidup kembali.
    source: Q3, NFR2

  - id: BR4.7
    statement: Logout mencabut sesi yang sedang dipakai.
    category: policy
    applies_to: Session
    trigger: POST /api/v1/auth/logout
    logic: "IF ada sesi valid THEN isi revokedAt sesi itu, hapus cookie ddcl_session di respons, dan jawab 204 (sesi lain milik pengguna yang sama tidak terpengaruh). IF tidak ada sesi valid THEN jawab 401"
    violation_behaviour: 401 bila tidak ada sesi aktif.
    source: Contract 1, Q3

  - id: BR4.8
    statement: Semua endpoint /api/v1/* kecuali login, dan health check, menolak permintaan tanpa sesi valid; stub dev-mode dicabut penuh tanpa saklar.
    category: authorization
    applies_to: Seluruh endpoint U1–U6
    trigger: Setiap permintaan ke /api/v1/*
    logic: "IF permintaan bukan POST /api/v1/auth/login, bukan /health, dan bukan permintaan preflight CORS (OPTIONS, yang tidak membawa kredensial dan hanya dijawab dengan header CORS tanpa data) DAN tidak punya sesi valid menurut BR4.6 THEN jawab 401 sebelum rute berjalan. HEAD diperlakukan seperti GET. Satu-satunya pembawa sesi yang diterima adalah cookie ddcl_session dan header Authorization Bearer (BR4.5, BR4.6). Cookie bernilai dev-session tidak lagi dikenali (hash-nya tidak ada di database). Tidak ada variabel lingkungan atau konfigurasi yang mematikan pemeriksaan ini. Penegakan dipasang satu kali di pintu masuk semua rute /api/v1/* sehingga endpoint baru dari U3/U5/U6 otomatis terlindungi; test U1–U3 memakai helper login"
    violation_behaviour: 401 tanpa isi data; tidak ada endpoint yang bisa dipanggil tanpa autentikasi.
    source: NFR2, AC6.2.1, Q7, Q14, review R-05

  - id: BR4.9
    statement: Tiga role menentukan aksi yang diizinkan; aksi di luar hak role ditolak 403.
    category: authorization
    applies_to: Seluruh endpoint U1–U6
    trigger: Setiap permintaan dengan sesi valid
    logic: "Matriks hak (role dibaca dari User di database pada tiap permintaan). viewer: semua GET (Library, DDCL, riwayat, rekap) dan ekspor Excel; tidak ada penulisan. editor: hak viewer + membuat dan mengubah step, bundle, dan DDCL, memasang step, menandai Sudah Dikirim, membuat versi baru, memegang dan melepas lock edit; tidak menghapus atau mengarsip apa pun dan tidak mengelola akun. admin: semua hak editor + menghapus atau mengarsip step, bundle, dan DDCL + mengelola akun (BR4.10, BR4.13, BR4.14, BR4.18, daftar akun) + melihat catatan audit (BR4.20). Semua pengguna: GET /auth/me, logout, dan ganti kata sandi sendiri. IF role sesi tidak termasuk yang diizinkan untuk rute itu THEN jawab 403 sebelum handler berjalan. Setiap rute menyatakan role minimalnya lewat satu pemeriksaan role bersama; rute tanpa pernyataan dianggap membutuhkan admin supaya endpoint baru aman secara bawaan. Role minimal rute U1–U3 yang sudah ada dipetakan di functional-spec.md (tabel rute ke role minimal); tanpa peta itu rute lama akan menolak editor dan viewer"
    violation_behaviour: 403 dengan pesan role tidak cukup; tidak ada perubahan tersimpan.
    source: Q1, Q9, Q10, AC6.2.1, review R-04, R-09

  - id: BR4.10
    statement: Hanya admin yang membuat akun baru; admin menentukan nama, email, role awal, dan kata sandi awal.
    category: authorization
    applies_to: User
    trigger: POST /api/v1/users
    logic: "IF pemanggil bukan admin THEN 403 (BR4.9). Validasi name (BR4.1 untuk email, 1–100 karakter untuk nama), role harus salah satu admin/editor/viewer, kata sandi awal memenuhi BR4.2. IF valid THEN buat User berstatus active dan jawab 201 dengan data akun tanpa passwordHash. Akun baru bisa langsung login dan, sesuai role-nya, memakai fitur portal seperti pengguna lain. Tidak ada halaman pendaftaran terbuka"
    violation_behaviour: 400/409/403 sesuai sebab; tidak ada akun tersimpan.
    source: FR9, AC6.2.1, Q1, Q11

  - id: BR4.11
    statement: Admin pertama dibuat otomatis saat backend start bila tidak ada akun sama sekali.
    category: policy
    applies_to: User
    trigger: Backend start
    logic: "IF tabel User kosong DAN ADMIN_EMAIL dan ADMIN_PASSWORD terisi dan sah menurut BR4.1/BR4.2 THEN buat User role admin berstatus active (name memakai ADMIN_NAME bila ada, bila tidak bagian lokal email). IF tabel User kosong DAN variabel itu tidak ada atau tidak sah THEN backend gagal start dengan pesan jelas (gagal cepat, tidak berjalan tanpa akun). IF tabel User sudah berisi THEN variabel itu diabaikan sepenuhnya (tidak membuat akun, tidak mengubah kata sandi). Pembuatan dilakukan dalam transaksi dengan pengecekan kosong sehingga dua instance yang start bersamaan tidak membuat dua admin"
    violation_behaviour: Backend tidak start; log menyebut variabel mana yang kurang, tanpa menulis nilai kata sandi.
    source: FR9, NFR2, Q1; phases/construction.md ## Security

  - id: BR4.12
    statement: Pengguna mengganti kata sandinya sendiri dengan menyebut kata sandi lama; sesi lain pengguna itu dicabut.
    category: policy
    applies_to: User, Session
    trigger: POST /api/v1/auth/password
    logic: "IF LoginThrottle email pengguna itu sedang terkunci THEN 429 tanpa memeriksa kata sandi (BR4.4). IF kata sandi lama tidak cocok THEN hitung ke LoginThrottle email pengguna itu (5 salah beruntun mengunci 15 menit) dan jawab 400 pesan generik; kata sandi lama yang benar mengosongkan penghitung. IF kata sandi baru tidak memenuhi BR4.2 atau sama dengan yang lama THEN 400. IF valid THEN simpan hash baru dan cabut semua sesi pengguna itu selain sesi yang sedang dipakai, lalu jawab 204"
    violation_behaviour: 400 atau 429; kata sandi tidak berubah.
    source: Q2, NFR2, NFR Requirements Q4, review R-02

  - id: BR4.13
    statement: Admin menonaktifkan akun lain; admin aktif terakhir dan akun sendiri tidak boleh dinonaktifkan.
    category: constraint
    applies_to: User, Session
    trigger: PATCH /api/v1/users/{id} dengan status inactive
    logic: "IF pemanggil bukan admin THEN 403. IF target adalah akun pemanggil sendiri THEN tolak 409. IF target adalah satu-satunya User active berstatus admin THEN tolak 409 (pemeriksaan dalam transaksi yang mengunci baris admin aktif agar dua penonaktifan paralel tidak menghabiskan admin). IF valid THEN status = inactive dan semua Session akun itu dicabut saat itu juga. Akun tidak dihapus; DDCL buatannya tetap menunjuk akun itu. Akun nonaktif tidak bisa login (BR4.3) dan tampil di daftar akun dengan status nonaktif. Mengaktifkan kembali tidak ada di layar atau API; hanya lewat skrip pemulihan di server (jalur di luar portal, dirancang di NFR Requirements). Penonaktifan dicatat sebagai AuditEvent (BR4.20)"
    violation_behaviour: 409 atau 403; tidak ada perubahan tersimpan.
    source: Q5, Q11, NFR2

  - id: BR4.14
    statement: Hanya admin yang mengubah role; role admin aktif terakhir tidak boleh diturunkan.
    category: constraint
    applies_to: User
    trigger: PATCH /api/v1/users/{id} dengan role
    logic: "IF pemanggil bukan admin THEN 403. IF role baru bukan salah satu admin/editor/viewer THEN 400. IF perubahan menurunkan satu-satunya User admin yang active THEN tolak 409 (diperiksa dalam transaksi yang sama dengan BR4.13). IF valid THEN simpan role baru; berlaku di permintaan berikutnya karena role dibaca dari database (BR4.9). Sesi tidak dicabut"
    violation_behaviour: 400/403/409; role tidak berubah.
    source: Q1, Q11

  - id: BR4.15
    statement: Permintaan tulis dari origin selain frontend yang diizinkan ditolak.
    category: validation
    applies_to: Seluruh rute tulis (POST, PUT, PATCH, DELETE) di /api/v1/*, termasuk login
    trigger: Permintaan tulis
    logic: "Daftar origin yang diizinkan datang dari konfigurasi ALLOWED_ORIGINS dan dipakai bersama oleh CORS dan pemeriksaan ini. IF permintaan tulis diautentikasi lewat Authorization Bearer THEN pemeriksaan Origin dilewati (pembawa ini tidak dikirim otomatis oleh browser sehingga tidak rentan CSRF, Q14). IF permintaan tulis diautentikasi lewat cookie, atau tanpa sesi (login), DAN membawa header Origin yang tidak sama persis dengan salah satu origin yang diizinkan THEN 403 sebelum rute berjalan. IF header Origin tidak ada THEN permintaan diteruskan (browser selalu mengirim Origin pada permintaan tulis lintas-situs, jadi ketiadaannya berarti klien non-browser; keamanan tetap dijaga sesi, BR4.8). Cookie SameSite=Lax menjadi lapisan kedua. Tidak ada token CSRF terpisah. Preflight OPTIONS dikecualikan (BR4.8)"
    violation_behaviour: 403; tidak ada perubahan tersimpan.
    source: Q8, Q14, NFR2, review R-05

  - id: BR4.16
    statement: DDCL mencatat pembuatnya dari sesi; DDCL lama diisi admin pertama lewat migrasi.
    category: policy
    applies_to: DdclDocument
    trigger: Pembuatan DDCL dan migrasi U4
    logic: "IF DDCL dibuat THEN createdByUserId = id User dari sesi (klien tidak bisa menentukannya). Migrasi U4 mengisi createdByUserId semua DdclDocument yang ada (createdBy stub dev-user) dengan id admin pertama, yaitu User ber-role admin dengan createdAt paling awal (id sebagai pemutus seri), lalu menjadikan kolom wajib dengan foreign key ke User; karena User tidak pernah dihapus, referensi selalu valid. Migrasi dijalankan setelah pembuatan admin pertama (BR4.11) dan dibungkus transaksi; bila tidak ada User atau migrasi gagal, backend tidak start. Pembuat tidak memberi hak khusus: hak ditentukan role saja (BR4.9)"
    violation_behaviour: Migrasi gagal membatalkan seluruh perubahan dan menghentikan start.
    source: Q6, Q11, review R-10

  - id: BR4.17
    statement: Hanya admin yang melihat daftar akun; respons akun tidak pernah memuat hash atau token.
    category: authorization
    applies_to: User
    trigger: GET /api/v1/users, GET /api/v1/auth/me, dan semua respons yang memuat data akun
    logic: "IF GET /api/v1/users atau GET /api/v1/audit-events dipanggil oleh non-admin THEN 403. Respons akun hanya memuat id, name, email, role, status, createdAt, lastLoginAt; passwordHash, tokenHash, dan token tidak pernah masuk respons maupun log. GET /auth/me melayani semua role dan memuat id, name, email, role"
    violation_behaviour: 403 untuk non-admin.
    source: NFR2, Q1; phases/construction.md ## Security

  - id: BR4.18
    statement: Admin mengatur ulang kata sandi akun lain dan membuka kunci login satu email lewat layar Akun.
    category: authorization
    applies_to: User, Session, LoginThrottle
    trigger: POST /api/v1/users/{id}/password dan POST /api/v1/users/{id}/unlock
    logic: "IF pemanggil bukan admin THEN 403. IF akun tidak ada THEN 404. Atur ulang kata sandi: admin mengetik kata sandi baru yang memenuhi BR4.2 (Q12); simpan hash baru, cabut semua sesi akun itu, kosongkan dan buka kunci LoginThrottle emailnya, jawab 204. Buka kunci: kosongkan LoginThrottle email akun itu, jawab 204 (idempoten bila tidak sedang terkunci). Akun nonaktif tetap tidak bisa login walau kata sandinya diatur ulang. Kedua aksi dicatat sebagai AuditEvent (BR4.20) tanpa memuat kata sandi. Admin boleh mengatur ulang kata sandi akunnya sendiri lewat ganti kata sandi (BR4.12), bukan lewat jalur ini"
    violation_behaviour: 400 untuk kata sandi tidak sah, 403, atau 404; tidak ada perubahan tersimpan.
    source: NFR Requirements Q3 (B), Q12, review R-01

  - id: BR4.19
    statement: Perubahan akun lewat PATCH /api/v1/users/{id} mengikuti aturan kasus tepi yang tetap dan atomik.
    category: validation
    applies_to: User
    trigger: PATCH /api/v1/users/{id}
    logic: "IF akun tidak ada THEN 404. IF isi permintaan kosong atau memuat field selain role dan status THEN 400. IF status bernilai active pada akun yang inactive THEN 409 (mengaktifkan kembali tidak lewat API, BR4.13). IF status inactive pada akun yang sudah inactive, atau role sama dengan role sekarang, THEN no-op idempoten dengan 200. IF isi memuat role dan status sekaligus THEN keduanya dinilai terhadap keadaan akhir dan disimpan dalam satu transaksi: seluruhnya berhasil atau seluruhnya ditolak (BR4.13, BR4.14). Respons 200 memuat data akun sesuai BR4.17"
    violation_behaviour: 400/404/409 sesuai sebab; tidak ada perubahan sebagian.
    source: review R-06, BR4.13, BR4.14

  - id: BR4.20
    statement: Peristiwa akun dicatat pada tabel audit yang hanya bisa ditambah, dibaca admin, dan disimpan 1 tahun.
    category: policy
    applies_to: AuditEvent
    trigger: Login berhasil, login gagal, penguncian, logout, akun dibuat, role diubah, akun dinonaktifkan, kata sandi diganti, kata sandi diatur ulang admin, kunci dibuka admin; dan GET /api/v1/audit-events
    logic: "IF salah satu peristiwa itu terjadi THEN satu AuditEvent ditambahkan dalam transaksi yang sama dengan perubahannya (gagal mencatat membatalkan perubahan akun; kegagalan mencatat login gagal tidak boleh mengubah jawaban 401 ke klien). AuditEvent tidak pernah memuat kata sandi, token, hash, atau isi cookie, dan tidak ada jalur pembaruan atau penghapusan oleh pengguna. Entri lebih tua dari 1 tahun dihapus otomatis oleh pembersihan terjadwal. GET /api/v1/audit-events hanya untuk admin, hanya baca, terbaru lebih dulu, dengan filter jenis dan rentang tanggal serta pembagian halaman (BR4.17)"
    violation_behaviour: 403 untuk non-admin; tidak ada rahasia yang masuk catatan.
    source: Q13, NFR Requirements Q5 (B), NFR2
```

## Ringkasan aturan

| ID | Kategori | Intinya | Sumber |
|---|---|---|---|
| BR4.1 | validation | Email dinormalisasi dan unik | FR9, AC6.2.1 |
| BR4.2 | validation | Kata sandi ≥10 karakter, scrypt + garam | Q2 |
| BR4.3 | authorization | Login hanya akun aktif; kegagalan generik | AC6.2.1 |
| BR4.4 | constraint | 5 gagal (login atau kata sandi lama) → kunci 15 menit | Q4 |
| BR4.5 | policy | Token acak, hash di database, cookie httpOnly | Q3 |
| BR4.6 | constraint | Sesi 8 jam diam, 7 hari mutlak | Q3 |
| BR4.7 | policy | Logout mencabut sesi | Contract 1 |
| BR4.8 | authorization | Semua endpoint wajib sesi; stub dicabut | NFR2 |
| BR4.9 | authorization | Matriks hak admin/editor/viewer | Q1, Q9, Q10 |
| BR4.10 | authorization | Admin membuat akun | FR9, Q11 |
| BR4.11 | policy | Admin pertama dari lingkungan | Q1 |
| BR4.12 | policy | Ganti kata sandi sendiri | Q2 |
| BR4.13 | constraint | Nonaktifkan akun; lindungi admin terakhir | Q5, Q11 |
| BR4.14 | constraint | Ubah role oleh admin | Q11 |
| BR4.15 | validation | Pemeriksaan Origin pada rute tulis | Q8 |
| BR4.16 | policy | createdByUserId + migrasi | Q6 |
| BR4.17 | authorization | Daftar akun dan audit hanya admin; tanpa hash di respons | NFR2 |
| BR4.18 | authorization | Admin atur ulang kata sandi dan buka kunci login | Q12, review R-01 |
| BR4.19 | validation | Kasus tepi PATCH akun, atomik | review R-06 |
| BR4.20 | policy | Tabel audit hanya-tambah, admin baca, retensi 1 tahun | Q13 |
