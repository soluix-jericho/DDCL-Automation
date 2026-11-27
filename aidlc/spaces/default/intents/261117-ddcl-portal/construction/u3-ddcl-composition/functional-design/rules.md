# Functional Design — u3-ddcl-composition — Business Rules

## Sources

- [memory] `requirements.md` FR1, FR3–FR6, FR10, FR10.1; `stories.md` AC2.1.1–AC2.4.1, AC3.1.1, AC3.2.1–AC3.2.2, AC6.1.1–AC6.1.2.
- [memory] U2 `rules.md` BR2.4 (variabel `{nama}`), BR2.8 (snapshot per item), BR2.14 (bundle dibaca untuk dipasang); U1 `rules.md` BR1.2 (DDCL baru berstatus Draft, diperluas di sini); `aidlc/spaces/default/memory/phases/construction.md` ## Error Handling, ## Security.
- [memory] U4 `contract-summary.md` (respons tambahan Contract 2–5, peta role); rute tak terdaftar bernilai admin di RoleRegistry.
- [Q1–Q13] jawaban `functional-design-questions.md`.

Aturan Unit sebelumnya tetap berlaku. BR1.2 (DDCL baru selalu Draft) tetap benar untuk pembuatan; status lanjutan diatur BR3.8.

```yaml
rules:
  - id: BR3.1
    statement: Membuat DDCL mewajibkan judul dan semua field header kecuali Technical Change; mengubah header tidak boleh mengosongkan field wajib.
    category: validation
    applies_to: DdclDocument, ReleaseHeader
    trigger: POST /api/v1/ddcls; PATCH /api/v1/ddcls/{id}; tanda Sudah Dikirim (BR3.8)
    logic: "IF title kosong setelah spasi ujung dibuang ATAU lebih dari 200 karakter ATAU salah satu dari date, startDate, impactedSystem, environment, phaseRelease, releaseObjective kosong setelah spasi ujung dibuang ATAU date atau startDate bukan tanggal kalender sah berformat YYYY-MM-DD THEN tolak dengan 400 dan sebutkan semua field yang bermasalah sekaligus (bukan satu per satu). technicalChange boleh kosong atau tidak dikirim. PATCH menerapkan aturan yang sama pada hasil gabungan data tersimpan dengan perubahan, sehingga field yang sudah terisi tidak bisa dikosongkan. Saat gagal, layar tetap menampilkan semua isian pengguna (tidak ada yang hilang); status tidak berubah dan tidak ada DDCL tersimpan sebagian. Batas panjang tiap field ditetapkan di NFR Requirements"
    violation_behaviour: Permintaan ditolak 400 dengan daftar field; tidak ada perubahan tersimpan.
    source: FR1, AC2.1.1, AC2.1.2, Q5

  - id: BR3.2
    statement: Menambah step ke checklist menyimpan snapshot step saat itu dan, bila step itu punya pasangan rollback, otomatis menambah satu baris rollback.
    category: calculation
    applies_to: ChecklistItem, RollbackItem
    trigger: POST /api/v1/ddcls/{id}/checklist-items
    logic: "IF stepId tidak ada THEN 404 dan tidak ada yang dibuat. IF step ber-kind rollback THEN 400 (step rollback masuk lewat pasangan atau bundle, bukan ke checklist). IF order bukan bilangan bulat >= 1 THEN 400; order lebih besar dari jumlah baris + 1 ditempatkan di akhir. Dalam satu transaksi (BR3.10): salin isi step dan salinan pasangan rollback-nya menjadi stepSnapshot (BR2.8), buat ChecklistItem dengan source=step pada posisi order (BR3.3), dan IF step punya pasangan rollback THEN buat satu RollbackItem (source=step, checklistItemId=item baru, stepSnapshot=salinan pasangan, order=jumlah rollback + 1). IF step tidak punya pasangan THEN tidak ada RollbackItem dan baris tampil dengan penanda Belum ada rollback (BR3.6). Step yang sama boleh ditambahkan berkali-kali; tiap penambahan adalah baris terpisah dengan pasangan rollback terpisah. Isian yang diminta per baris adalah variabel {nama} di teks langkah (BR2.4), bukan isian tetap per kategori"
    violation_behaviour: Permintaan ditolak (404 atau 400); tidak ada item atau rollback tersimpan sebagian.
    source: FR3, FR4.1, AC2.2.1, AC2.2.3, AC2.3.1, U2 BR2.8

  - id: BR3.3
    statement: Posisi baris checklist dan posisi baris rollback masing-masing selalu berurutan rapat dari 1, dan perubahan urutan tersimpan.
    category: constraint
    applies_to: ChecklistItem, RollbackItem
    trigger: Menambah, memindahkan, menduplikasi, atau menghapus baris; memasang bundle
    logic: "IF baris disisipkan di posisi p THEN baris dengan posisi >= p bergeser +1. IF baris dipindah ke posisi q THEN baris di antara posisi lama dan q bergeser satu langkah dan posisi q di luar 1..jumlah ditempatkan di batas terdekat (q bukan bilangan bulat >= 1 ditolak 400). IF baris dihapus THEN baris sesudahnya bergeser -1. Seluruh penataan ulang terjadi dalam transaksi yang sama dengan perubahannya. Urutan checklist dan urutan rollback saling bebas: memindahkan satu tidak menggeser yang lain. Urutan tersimpan dan terbaca sama saat DDCL dibuka kembali. Rute baris checklist: PATCH /checklist-items/{itemId} menerima order (aturan ini) dan parameterValues (BR3.4), keduanya opsional; DELETE /checklist-items/{itemId} menghapus baris beserta RollbackItem pasangannya (BR3.12) lalu merapatkan posisi, 404 bila baris bukan milik DDCL ini; keduanya tunduk pada BR3.10"
    violation_behaviour: Posisi tidak sah ditolak 400; tidak pernah ada celah atau nomor ganda yang tersimpan.
    source: FR3.1, AC2.2.2, Q4

  - id: BR3.4
    statement: Nilai isian sebuah baris adalah objek nama variabel ke teks, dan hanya nama variabel yang ada di step baris itu yang diterima.
    category: validation
    applies_to: ChecklistItem, RollbackItem
    trigger: PATCH /api/v1/ddcls/{id}/checklist-items/{itemId}; PATCH /api/v1/ddcls/{id}/rollback-items/{rid}; nilai awal saat menambah step
    logic: "IF parameterValues bukan objek JSON ATAU ada kunci yang bukan variabel di stepSnapshot baris itu (himpunan variabel diturunkan seperti U2 BR2.4) ATAU ada nilai yang bukan teks atau null THEN tolak 400 dan sebutkan kunci atau nilai yang bermasalah. PATCH mengganti seluruh objek nilai (klien mengirim objek penuh); nilai kosong atau null berarti belum diisi. Variabel yang belum diisi diperbolehkan di status Draft; kelengkapan diperiksa saat ekspor (U6, AC4.1.3). Batas ukuran nilai ditetapkan di NFR Requirements. Nilai tidak pernah ditulis ke stepSnapshot"
    violation_behaviour: Permintaan ditolak 400; nilai lama tidak berubah.
    source: FR3.3, AC2.2.1, U2 BR2.4, U2 BR2.8

  - id: BR3.5
    statement: Menduplikasi baris checklist membuat baris terpisah tepat di bawahnya, lengkap dengan rollback pasangannya sendiri bila baris asal punya.
    category: calculation
    applies_to: ChecklistItem, RollbackItem
    trigger: POST /api/v1/ddcls/{id}/checklist-items/{itemId}/duplicate
    logic: "IF itemId bukan milik DDCL ini THEN 404. Dalam satu transaksi (BR3.10): buat ChecklistItem baru di posisi asal + 1 dengan source, stepSnapshot, dan parameterValues disalin apa adanya dari baris asal (BR3.3 menggeser baris sesudahnya); IF baris asal punya RollbackItem pasangan THEN buat RollbackItem baru (checklistItemId=baris baru, snapshot dan nilai disalin) di posisi jumlah rollback + 1. Baris asal tidak berubah. Baris dari bundle menghasilkan salinan dari bundle tanpa rollback tambahan (rollback bundle berdiri sendiri, BR2.14)"
    violation_behaviour: Ditolak 404 bila baris tidak ada; tidak ada salinan sebagian.
    source: FR3.2, AC2.2.3

  - id: BR3.6
    statement: Memasang bundle menambah semua step forward anggotanya ke checklist dan menambah rangkaian rollback bundle sesuai urutan tersimpan; pasangan rollback per step anggota tidak dipasang tambahan.
    category: calculation
    applies_to: ChecklistItem, RollbackItem
    trigger: POST /api/v1/ddcls/{id}/bundle-items
    logic: "Dalam satu transaksi (BR3.10): baca bundle sesuai U2 BR2.14. IF bundleId tidak ada THEN 404 dan tidak ada yang dibuat. Tiap anggota forward menjadi ChecklistItem (source=bundle) berurutan mulai posisi order sesuai urutan bundle (BR3.3), masing-masing dengan stepSnapshot sendiri (BR2.8) dan tanpa RollbackItem pasangan. Tiap anggota rollback menjadi RollbackItem (source=bundle, checklistItemId kosong) ditambahkan di akhir daftar rollback dalam urutan seperti disimpan di bundle (tidak dibalik otomatis). IF rangkaian rollback bundle kosong THEN tidak ada rollback ditambahkan dan respons memuat bundleHasNoRollback=true agar layar memberi tahu pengguna. Penanda Belum ada rollback pada baris checklist diturunkan saat dibaca dan hanya menyatakan bahwa step di Library tidak punya pasangan rollback: berlaku bila source=step dan stepSnapshot tidak memuat pasangan rollback; baris source=bundle tidak diberi penanda per baris. Pengguna yang menghapus baris rollback pasangan secara manual (BR3.12) tidak memunculkan penanda, karena itu pilihan sadar pengguna"
    violation_behaviour: Bundle tidak ada ditolak 404; tidak ada baris tersimpan sebagian.
    source: FR4, FR4.1, Q3, U2 BR2.14, AC2.3.1

  - id: BR3.7
    statement: Tanggal kirim, tanggal eksekusi, dan tanggal rollback terisi otomatis dari jam database saat status berubah, boleh diubah pengguna, dan harus berurutan.
    category: constraint
    applies_to: DdclDocument
    trigger: Perubahan status (BR3.8); PATCH /api/v1/ddcls/{id}/dates
    logic: "IF perubahan status menyertakan tanggal valid THEN tanggal itu dipakai, ELSE nilainya now() jam database. IF tanggal bukan waktu sah berformat ISO 8601 THEN 400. Urutan wajib sentAt <= executedAt <= rolledBackAt untuk yang terisi; IF dilanggar THEN 400 yang menyebut pasangan tanggal yang bertentangan. PATCH /dates menerima himpunan bagian dari tanggal yang statusnya sudah tercapai (mis. executedAt hanya bila status Tereksekusi atau Di-rollback); IF tanggal belum tercapai dikirim THEN 400. PATCH /dates menjalankan pemeriksaan urutan terhadap nilai tersimpan di dalam transaksi yang mengunci baris DdclDocument (FOR UPDATE) agar dua perubahan tanggal serentak tidak meloloskan urutan yang bertentangan, tidak memerlukan lock edit (BR3.9), dan di status Draft ditolak 403 (belum ada tanggal). Tanggal di masa depan diterima. Perubahan tanggal tidak mengubah status atau isi DDCL"
    violation_behaviour: Ditolak 400 (atau 403 di Draft); tanggal lama tidak berubah.
    source: Q7, Q10, AC3.1.1

  - id: BR3.8
    statement: Status berjalan satu arah Draft, Sudah Dikirim, Tereksekusi, Di-rollback; hanya tombol yang sesuai status saat ini yang berlaku dan tidak ada langkah mundur.
    category: constraint
    applies_to: DdclDocument
    trigger: POST /api/v1/ddcls/{id}/submit; POST /api/v1/ddcls/{id}/execute; POST /api/v1/ddcls/{id}/rollback
    logic: "submit: IF status Draft THEN (pemanggil memegang lock, BR3.10, dan header lengkap menurut BR3.1) set status=SudahDikirim, sentAt (BR3.7), lepas lock. execute: IF status SudahDikirim THEN set status=Tereksekusi dan executedAt. rollback: IF status Tereksekusi THEN set status=DiRollback, rolledBackAt, dan rollbackNote opsional (maksimal 500 karakter, selebihnya 400). Setiap perubahan memakai UPDATE bersyarat pada status yang diharapkan sehingga bila dua orang menekan bersamaan tepat satu yang berhasil. IF status saat ini bukan yang diharapkan THEN 409 dengan status saat ini (kontrak submit: 409 bila sudah Sudah Dikirim). Tidak ada rute untuk membatalkan atau memundurkan status. Di-rollback adalah status akhir; satu-satunya jalan lanjut adalah versi baru (BR3.14)"
    violation_behaviour: Dijawab 409; status tidak berubah.
    source: FR6, FR6.1, AC3.1.1, Q7, Q10, Q13

  - id: BR3.9
    statement: Lock edit dipegang satu pengguna pada satu DDCL berstatus Draft dan dilepas otomatis setelah 15 menit tanpa aktivitas pemegangnya.
    category: policy
    applies_to: DdclDocument
    trigger: POST /api/v1/ddcls/{id}/lock; DELETE /api/v1/ddcls/{id}/lock; pembuatan DDCL; pembacaan DDCL
    logic: "Ambil/perpanjang: UPDATE bersyarat atomik yang berhasil bila status Draft DAN (tidak ada pemegang ATAU pemegang adalah pemanggil ATAU lockedAt lebih tua dari 15 menit menurut jam database); hasilnya lockedByUserId=pemanggil dan lockedAt=now() jam database. IF tidak berhasil karena pemegang lain masih aktif THEN 409 dengan nama pemegang dan waktu lock berakhir; IF status bukan Draft THEN 403. Lock yang lebih tua dari 15 menit dianggap sudah lepas oleh siapa pun yang membaca atau mengambilnya; tidak ada tugas latar belakang yang menghapusnya. Setiap simpan berhasil oleh pemegang memperbarui lockedAt. Layar edit yang terbuka memperpanjang lock tiap 5 menit selama tab terbuka; menutup tab tanpa melepas membuat lock habis sendiri dalam 15 menit. Lepas eksplisit: IF pemanggil pemegang atau tidak ada lock aktif THEN 204 (idempoten); IF pemegang aktif orang lain THEN 409. DDCL Draft yang baru dibuat (baru atau revisi) langsung dikunci oleh pembuatnya. Lock dilepas otomatis saat DDCL dikirim (BR3.8) dan hilang bersama DDCL yang dihapus (BR3.16). GET tidak pernah mengambil lock; respons memuat nama pemegang aktif, waktu berakhir, dan lockedByMe sehingga pengguna lain melihat mode baca dengan pemberitahuan siapa yang mengedit. Batas 15 menit dibaca dari konfigurasi dengan nilai bawaan 15"
    violation_behaviour: Pengambilan oleh orang lain ditolak 409; pembacaan selalu diizinkan dalam mode baca.
    source: FR10, FR10.1, AC6.1.1, AC6.1.2, Q1

  - id: BR3.10
    statement: Setiap perubahan isi DDCL mensyaratkan status Draft dan lock aktif yang dipegang pemanggil, diperiksa di dalam transaksi perubahan itu sendiri.
    category: constraint
    applies_to: DdclDocument, ChecklistItem, RollbackItem, ReleaseHeader
    trigger: PATCH header; tambah, ubah, duplikasi, dan hapus baris checklist; pasang bundle; ubah dan hapus baris rollback; submit
    logic: "Di awal transaksi baris DdclDocument dikunci (FOR UPDATE) lalu: IF status bukan Draft THEN 403 (read-only, BR3.11). IF tidak ada lock aktif atas nama pemanggil THEN 409; kode kesalahan membedakan lock_required (tidak ada pemegang, atau lock pemanggil sudah habis; layar mengambil lock lagi dan mengulang, isian di layar tetap) dari locked_by_other (disertai nama pemegang). IF lolos THEN lakukan perubahan dan perbarui lockedAt dalam transaksi yang sama. Dengan begitu lock yang habis di tengah penyimpanan tidak bisa meloloskan tulisan"
    violation_behaviour: Ditolak 403 atau 409; tidak ada perubahan tersimpan.
    source: FR10, AC6.1.1, Contract 3 (409 dikunci pengguna lain, 403 read-only)

  - id: BR3.11
    statement: DDCL yang sudah Sudah Dikirim atau lebih jauh menjadi read-only: isi tidak bisa diubah, hanya tanggal status, perpindahan status berikutnya, dan pembuatan versi baru yang masih berlaku.
    category: constraint
    applies_to: DdclDocument, ReleaseHeader, ChecklistItem, RollbackItem
    trigger: Setiap permintaan tulis terhadap DDCL yang statusnya bukan Draft
    logic: "IF status bukan Draft THEN PATCH header, semua rute baris checklist, bundle, dan rollback ditolak 403 dengan pesan DDCL sudah dikirim dan tidak bisa diedit langsung. Yang tetap diizinkan: PATCH /dates (BR3.7), perpindahan status berikutnya (BR3.8), dan POST /versions (BR3.14). Layar menampilkan semua isian dalam mode baca dan menyembunyikan kontrol edit, tetapi backend yang menegakkan"
    violation_behaviour: Ditolak 403; tidak ada perubahan tersimpan.
    source: FR6.1, AC3.1.1

  - id: BR3.12
    statement: Baris rollback bisa diurutkan ulang, diisi nilainya, atau dihapus satu per satu, terpisah dari checklist.
    category: policy
    applies_to: RollbackItem
    trigger: PATCH /api/v1/ddcls/{id}/rollback-items/{rid}; DELETE /api/v1/ddcls/{id}/rollback-items/{rid}
    logic: "IF rid bukan milik DDCL ini THEN 404. PATCH menerima order (BR3.3) dan parameterValues (BR3.4), keduanya opsional. DELETE menghapus baris lalu merapatkan posisi (BR3.3), baik baris berasal dari pasangan step maupun dari bundle. Menghapus ChecklistItem ikut menghapus RollbackItem pasangannya (checklistItemId); rollback dari bundle tidak ikut terhapus saat anggota forward bundle dihapus. Tidak ada rute untuk membuat baris rollback langsung; baris hanya lahir dari BR3.2, BR3.5, dan BR3.6"
    violation_behaviour: 404 bila baris tidak ada; tidak ada perubahan tersimpan.
    source: FR4, FR4.1, Q3, Q4, Contract 3 (hapus baris step dan rollback pasangannya)

  - id: BR3.13
    statement: Checklist Capture di v1 hanya tabel kosong berkolom mengikuti template dan tidak menyimpan data.
    category: policy
    applies_to: CaptureNote
    trigger: Pembacaan DDCL; ekspor (U6)
    logic: "Respons GET DDCL memuat capture.columns berisi Step, Actual Time, Capture Before, Capture After (sesuai sheet Checklist Capture di template) dan tidak ada baris data. Tidak ada rute tulis capture di v1: POST /capture-notes di Contract 3 tidak dibangun. Tabel kosong tidak menghalangi langkah apa pun (tidak divalidasi, tidak terhubung ke step). Revisi (BR3.14) tidak punya capture untuk disalin"
    violation_behaviour: Tidak berlaku; tidak ada jalur menulis capture.
    source: FR5, AC2.4.1, Q6, Q12

  - id: BR3.14
    statement: Versi baru dibuat dari DDCL yang sudah dikirim, selalu dari versi terbaru keluarganya, berstatus Draft, menyalin isi, dan bernama "<judul asli> v<N>".
    category: calculation
    applies_to: DdclDocument, ReleaseHeader, ChecklistItem, RollbackItem
    trigger: POST /api/v1/ddcls/{id}/versions
    logic: "IF status DDCL asal bukan salah satu dari SudahDikirim, Tereksekusi, DiRollback THEN 403 (Draft belum boleh direvisi). IF versionNumber DDCL asal bukan yang tertinggi di familyId-nya THEN 409 newer_version_exists dengan id versi terbaru (tidak ada percabangan versi). Dalam satu transaksi: buat DdclDocument baru dengan status Draft, familyId sama, versionNumber = nomor asal + 1, parentDdclId = asal, createdByUserId = pemanggil, dikunci oleh pemanggil (BR3.9), dan title = judul DDCL versi 1 keluarga itu + ' v' + N (AC3.2.1: 'DDCL BCAS PROD 202611 v2'; AC3.2.2: v3 dari v2, terhubung ke v2). Judul turunan ini tidak dibatasi 200 karakter (batas 200 hanya berlaku untuk judul yang diketik pengguna, BR3.1; PATCH memeriksa judul hanya bila judul ikut dikirim). Salin seluruh ReleaseHeader, seluruh ChecklistItem (stepId bila step masih ada, null bila sudah dihapus, order, source, stepSnapshot apa adanya tanpa disegarkan dari Library, parameterValues), dan seluruh RollbackItem (order, source, snapshot, nilai; checklistItemId dipetakan ke salinan baru). Tanggal status, rollbackNote, dan lock tidak disalin; DDCL asal tidak berubah. IF pelanggaran unik (familyId, versionNumber) terjadi karena dua permintaan serentak THEN 409 newer_version_exists. Tidak ada capture untuk disalin (BR3.13)"
    violation_behaviour: Ditolak 403 atau 409; tidak ada DDCL sebagian tersimpan.
    source: FR6.2, AC3.2.1, AC3.2.2, Q2, Q8, Q11, Q13

  - id: BR3.15
    statement: Daftar DDCL dikelompokkan per DDCL asli, satu baris per keluarga versi, dengan daftar semua versinya untuk dropdown.
    category: policy
    applies_to: DdclDocument
    trigger: GET /api/v1/ddcls (Contract 5, dibangun U5); GET /api/v1/ddcls/{id}
    logic: "Tiap baris daftar mewakili satu familyId dan memuat versi terbaru (id, title, status, versionNumber, tanggal status, pembuat, createdAt) serta versions: daftar berurutan menurut versionNumber naik dari versi 1 sampai terbaru, masing-masing id, versionNumber, title, status, supaya layar menampilkan dropdown dari versi pertama sampai terakhir. Memilih versi di dropdown membuka DDCL milik id itu. GET /ddcls/{id} memuat daftar versions yang sama untuk keluarganya. Bentuk ini mengikat U5; cara filter dan pencarian bekerja di atas keluarga ini ditetapkan U5 tanpa mengubah isi baris"
    violation_behaviour: Tidak berlaku; ini bentuk respons.
    source: FR6.2, Q2, Contract 3 dan 5 (pertanyaan terbuka bentuk GET /ddcls)

  - id: BR3.16
    statement: Hanya admin yang boleh menghapus DDCL, dan hanya yang berstatus Draft.
    category: constraint
    applies_to: DdclDocument, ReleaseHeader, ChecklistItem, RollbackItem
    trigger: DELETE /api/v1/ddcls/{id}
    logic: "IF DDCL tidak ada THEN 404. IF status bukan Draft THEN 403. IF ada lock aktif milik orang lain THEN 409 locked_by_other. IF lolos THEN hapus header, semua ChecklistItem, dan semua RollbackItem dalam satu transaksi lalu jawab 204. Draft tidak pernah punya versi turunan (versi hanya lahir dari DDCL yang sudah dikirim), sehingga penghapusan tidak memutus rantai versi; foreign key tetap menolak bila ternyata ada anak. Layar meminta konfirmasi yang menyebut judul DDCL sebelum menghapus. Penghapusan tidak bisa dibatalkan di v1"
    violation_behaviour: Ditolak 403, 404, atau 409; tidak ada yang terhapus.
    source: Q9, U4 contract-summary (peta role mencantumkan DELETE DDCL sebagai admin), NFR4

  - id: BR3.17
    statement: Rute U3 mengikuti peta role U4: viewer hanya membaca, editor dan admin menyusun dan mengubah status, admin saja yang menghapus DDCL.
    category: constraint
    applies_to: DdclDocument
    trigger: Setiap rute di bawah /api/v1/ddcls
    logic: "GET semua rute U3: viewer, editor, admin. POST/PATCH/DELETE untuk lock, header, baris checklist, bundle, baris rollback, dates, submit, execute, rollback, dan versions: editor dan admin. DELETE /ddcls/{id}: admin. Setiap rute baru wajib dideklarasikan di RoleRegistry karena rute tak terdaftar bernilai admin; test 'setiap rute punya deklarasi role' (NFR5.20) tetap berlaku. Rute yang gagal ditegakkan menjawab 403 oleh SessionGate sebelum aturan di atas"
    violation_behaviour: Ditolak 403 oleh SessionGate.
    source: U4 BR4.9, NFR5.20

  - id: BR3.18
    statement: Migrasi mengisi data DdclDocument yang sudah ada sehingga semua batasan baru terpenuhi tanpa mengubah arti data lama.
    category: constraint
    applies_to: DdclDocument
    trigger: Migrasi database U3 pada data yang sudah ada (dari U1 dan U4)
    logic: "Dalam migrasi yang sama dengan penambahan kolom dan nilai enum: tambah nilai status Tereksekusi dan DiRollback; tambah familyId, versionNumber, parentDdclId, sentAt, executedAt, rolledBackAt, rollbackNote, lockedByUserId, lockedAt sebagai nullable lebih dulu; isi baris lama dengan familyId=id, versionNumber=1, parentDdclId kosong, lock kosong; IF baris lama berstatus SudahDikirim THEN sentAt=createdAt (U1 hanya membuat Draft sehingga ini hanya pengaman); lalu jadikan familyId dan versionNumber wajib, dan pasang constraint unik (familyId, versionNumber) serta constraint tanggal status. Baris lama tidak kehilangan data apa pun. Migrasi mengikuti prosedur cadangan sebelum migrasi dari U2 (Infrastructure Design U3 memastikannya tetap berlaku)"
    violation_behaviour: Migrasi gagal bila ada baris yang tidak bisa dipenuhi; tidak ada data tersimpan setengah jalan (transaksi migrasi).
    source: Review R-01 (migrasi data lama), U2 pre-migration backup

```

## Perubahan Kontrak 3 yang diputuskan di desain ini

- Rute baru: `POST /ddcls/{id}/execute`, `POST /ddcls/{id}/rollback`, `PATCH /ddcls/{id}/dates`, `POST /ddcls/{id}/checklist-items/{itemId}/duplicate`, `POST /ddcls/{id}/bundle-items`, `PATCH` dan `DELETE /ddcls/{id}/rollback-items/{rid}`, `DELETE /ddcls/{id}`.
- Rute di Contract 3 yang tidak dibangun di v1: `POST /ddcls/{id}/capture-notes` (BR3.13).
- Nilai status baru `Tereksekusi` dan `Di-rollback`; field respons baru `familyId`, `versionNumber`, `parentDdclId`, `versions`, `sentAt`, `executedAt`, `rolledBackAt`, `rollbackNote`, info lock (`lockedBy`, `lockExpiresAt`, `lockedByMe`), dan `capture.columns`. Field baru di respons aman tanpa versi URL baru (Contract Ownership Rules).

## Assumptions & Open Questions

- [assumption] Versi baru juga boleh dibuat dari DDCL berstatus Di-rollback. Ringkasan yang Anda setujui hanya menyebut Sudah Dikirim dan Tereksekusi; tanpa ini Di-rollback menjadi jalan buntu karena tidak ada rute mundur. Mudah dibatasi bila tidak diinginkan (BR3.14).
- [assumption] Tanggal kirim, eksekusi, dan rollback disimpan sebagai tanggal dan jam, bukan hanya tanggal, karena Q7 jawaban A (awal) menyebut tanggal dan jam saat tombol ditekan.
- [assumption] Tanggal eksekusi tidak boleh lebih awal dari tanggal kirim, dan tanggal rollback tidak lebih awal dari tanggal eksekusi (BR3.7); Anda bisa mengubah tanggal kirim lebih dulu bila perlu.
- [assumption] Lock diperpanjang oleh layar edit tiap 5 menit selama tab terbuka, bukan hanya oleh simpan, supaya pengguna yang masih mengetik tidak kehilangan lock (BR3.9).
- [assumption] Pembuat DDCL atau revisi langsung memegang lock (BR3.9, BR3.14).
- [assumption] Mengubah judul DDCL Draft dilakukan lewat PATCH header (BR3.1); versi baru diberi nama dari judul versi 1 saat revisi dibuat.
- Perubahan di luar rencana yang butuh persetujuan orang: dua status baru melampaui `requirements.md` FR6 dan `stories.md` US3.1 (hanya Draft dan Sudah Dikirim); `unit-of-work.md` U3, `requirements.md`, dan `stories.md` belum diperbarui. Capture hanya tabel kosong (AC2.4.1 ditunda, lihat `traceability.json`).
