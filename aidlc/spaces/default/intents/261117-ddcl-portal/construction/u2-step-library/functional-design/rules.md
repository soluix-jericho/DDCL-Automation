# Functional Design — u2-step-library — Business Rules

Sumber: `requirements.md` (FR2, FR2.1–FR2.4, FR4), `stories.md` (US1.1–US1.3), jawaban `functional-design-questions.md` Q1–Q11, `aidlc/spaces/default/memory/phases/construction.md` ## Error Handling, ## Security. Aturan Unit sebelumnya (`u1-walking-skeleton/functional-design/rules.md`) tetap berlaku; aturan validasi pembuatan step di sana diperluas oleh BR2.1.

```yaml
rules:
  - id: BR2.1
    statement: Membuat atau mengedit step mewajibkan nama, kategori yang sah, jenis, dan setidaknya satu langkah yang tidak kosong.
    category: validation
    applies_to: Step, StepColumn, StepLine
    trigger: Permintaan membuat atau mengubah step (POST/PATCH /api/v1/steps)
    logic: "IF name kosong setelah spasi ujung dibuang ATAU category bukan salah satu dari Database, Bastion, RabbitMQ, Keycloak ATAU kind bukan forward/rollback ATAU tidak ada satu pun StepLine dengan text tidak kosong THEN tolak dengan 400 dan sebutkan setiap field yang bermasalah"
    violation_behaviour: Permintaan ditolak, status HTTP 400, tidak ada perubahan tersimpan.
    source: FR2, FR2.1, AC1.1.1

  - id: BR2.2
    statement: Isi step berupa kolom-kolom langkah bernomor; form step baru dimulai dengan 3 kolom dan pengguna bisa menambah atau mengurangi kolom.
    category: policy
    applies_to: StepColumn, StepLine
    trigger: Pengguna membuka form step baru atau menekan tombol tambah/hapus kolom atau langkah
    logic: "IF form step baru dibuka THEN tampilkan 3 kolom kosong. IF pengguna menambah/menghapus kolom atau langkah THEN position kolom dan langkah dirapatkan berurutan dari 1 dan nomor langkah ditampilkan dari position. IF pengguna menghapus kolom yang masih berisi langkah THEN layar meminta konfirmasi lebih dulu dan menyebut jumlah langkah yang ikut hilang. IF kolom terakhir dihapus THEN tolak (sebuah step minimal satu kolom). IF step disimpan THEN langkah yang teksnya kosong dan kolom yang tidak punya langkah berisi dibuang sebelum disimpan, kecuali BR2.1 membuat tidak ada yang tersisa (maka ditolak sesuai BR2.1)"
    violation_behaviour: Hapus kolom terakhir ditolak dengan pesan di layar; tidak ada kolom hilang tanpa konfirmasi bila berisi.
    source: Q1, Q9 (permintaan pengguna: judul + kolom langkah, bisa ditambah lewat tombol)

  - id: BR2.3
    statement: Nama step yang sama dengan kategori dan jenis yang sama tidak boleh dibuat dua kali; sistem menawarkan memakai step yang sudah ada.
    category: constraint
    applies_to: Step
    trigger: Permintaan membuat step baru (termasuk rollbackStep inline) atau mengganti nama/kategori/jenis step
    logic: "IF ada Step lain dengan category sama, kind sama, dan name sama (tanpa membedakan huruf besar/kecil, spasi ujung dibuang) THEN tolak dengan 409 dan sertakan isi lengkap step yang sudah ada (kolom, langkah, lampiran) serta conflictOn = step atau rollbackStep, agar layar bisa menampilkan popup perbandingan step yang ada dengan step yang baru diketik, dengan pilihan Pakai step yang sudah ada atau Ubah nama. Jenis ikut kunci keunikan supaya step forward dan pasangan rollback-nya boleh bernama mirip atau sama. IF rollbackStep inline yang bentrok THEN seluruh permintaan ditolak, tidak ada step forward maupun rollback yang tersimpan"
    violation_behaviour: Permintaan ditolak 409; tidak ada duplikat tersimpan; pengguna tidak punya jalan membuat duplikat.
    source: AC1.1.2, Q5, Contract 2 (409 duplikat per kategori)

  - id: BR2.4
    statement: Variabel di teks langkah ditulis {nama}; isian per DDCL diturunkan dari variabel itu dan tidak ada daftar isian tetap per kategori.
    category: calculation
    applies_to: StepLine, Step
    trigger: Step disimpan atau dibaca; step dipasang ke DDCL
    logic: "Teks langkah dipindai dari kiri ke kanan, satu token pada satu waktu: (1) {{ menjadi kurung kurawal buka literal; (2) }} menjadi kurung kurawal tutup literal; (3) { diikuti nama lalu } adalah variabel, dengan nama sesuai ^[A-Za-z0-9_-]+$ dan membedakan huruf besar/kecil (Host dan host adalah dua variabel); (4) setiap { atau } lain, termasuk {} kosong, { nama } dengan spasi, {a.b}, dan JSON seperti {\"a\":1}, ditolak dengan 400 yang menyebut kolom, baris, dan posisi karakter serta petunjuk menulis {{ dan }} untuk kurung literal atau memindahkan teks kode ke lampiran. Contoh urutan pemindaian: {{{x}}} dibaca sebagai { literal, variabel x, } literal. Himpunan variabel = nama unik dari semua StepLine, urutan kemunculan pertama. Teks disimpan apa adanya (termasuk {{ dan }}); penggantian {{ dan }} menjadi kurung literal dan pengisian variabel dilakukan saat tampil dan saat ekspor oleh satu fungsi render bersama di backend, sehingga tampilan layar, snapshot yang dibaca U3, dan ekspor U6 memberi hasil yang sama. Isi lampiran tidak dipindai untuk variabel (kurung kurawal di yaml, sql, json adalah kode biasa). IF step tanpa variabel THEN tidak ada isian yang diminta saat dipasang"
    violation_behaviour: Token kurung kurawal yang tidak sah ditolak 400; variabel tidak pernah tersimpan terpisah, selalu diturunkan dari teks.
    source: AC1.1.3, FR2.1, Q2, Q10 (keputusan pengguna: isian berbeda mengikuti ada tidaknya variabel)

  - id: BR2.5
    statement: Lampiran step berupa teks dengan nama file unik dalam satu step, tanpa path, dan ukuran dibatasi.
    category: validation
    applies_to: StepAttachment
    trigger: Permintaan membuat atau mengubah step dengan lampiran
    logic: "IF filename kosong ATAU memuat pemisah path (/ atau \\) ATAU sama dengan filename lain di step yang sama (tanpa membedakan huruf besar/kecil) ATAU content melebihi batas ukuran yang ditetapkan di NFR Design ATAU content bukan teks UTF-8 yang sah THEN tolak dengan 400 dan sebutkan lampiran yang bermasalah. Ekstensi bebas"
    violation_behaviour: Permintaan ditolak 400; tidak ada lampiran tersimpan sebagian.
    source: Q3; phases/construction.md ## Security (validasi input di batas sistem)

  - id: BR2.6
    statement: Daftar Library menampilkan jumlah DDCL yang memakai tiap step, dihitung di lapisan endpoint.
    category: calculation
    applies_to: Step, ChecklistItem
    trigger: Permintaan daftar step (GET /api/v1/steps)
    logic: "IF daftar step dibaca THEN usageCount tiap step = jumlah DdclDocument berbeda yang punya ChecklistItem dengan stepId sama dengan step itu; penggabungan dilakukan di lapisan endpoint (ADR-002), bukan oleh StepLibrary memanggil DdclDocument. Item yang stepId-nya sudah null tidak dihitung ke step mana pun. Item rollback yang dipasang otomatis oleh U3 ikut dihitung ke step rollback hanya bila U3 menyimpan stepId-nya; keputusan itu ada di U3"
    violation_behaviour: Tidak berlaku; ini perhitungan tampilan.
    source: AC1.2.1, FR2.3, ADR-002

  - id: BR2.7
    statement: Step selalu boleh dihapus dari Library, dan DDCL yang sudah memakainya tidak berubah.
    category: policy
    applies_to: Step, ChecklistItem, StepBundle
    trigger: Permintaan hapus step (DELETE /api/v1/steps/{id})
    logic: "IF step ada THEN hapus Step beserta kolom, langkah, dan lampirannya DAN set pairedRollbackStepId = null pada step forward yang menunjuknya DAN keluarkan dari keanggotaan bundle manapun (posisi anggota lain dirapatkan; anggota rollback yang habis membuat rangkaian rollback bundle kosong, yang sah) DAN hapus bundle yang kehilangan anggota forward terakhirnya DAN set ChecklistItem.stepId = null untuk semua item yang merujuknya, tanpa menyentuh stepSnapshot. Sistem menampilkan sebelum pengguna mengonfirmasi: jumlah pemakaian, bundle yang akan ikut terhapus, dan step forward yang kehilangan pasangan rollback; tetapi tidak satu pun dari itu menolak penghapusan. IF step tidak ada THEN 404"
    violation_behaviour: Step tidak ditemukan dijawab 404; tidak ada DDCL berubah dalam kondisi apa pun.
    source: AC1.2.2, FR2.4

  - id: BR2.8
    statement: Memasang step ke DDCL menyimpan snapshot isi step saat itu; perubahan atau penghapusan Library sesudahnya tidak mengubah DDCL yang sudah ada.
    category: constraint
    applies_to: ChecklistItem, Step
    trigger: Item checklist dibuat (POST /api/v1/ddcls/{id}/checklist-items); step diedit atau dihapus
    logic: "IF ChecklistItem dibuat THEN stepSnapshot diisi salinan penuh step (name, category, kind, kolom dan langkah, lampiran, dan salinan pasangan rollback bila ada) pada saat itu. Pembacaan step dan pembuatan snapshot terjadi dalam satu transaksi dengan pembuatan item; IF stepId sudah tidak ada saat itu THEN permintaan ditolak 404 dan tidak ada item dibuat. Item yang sudah ada sebelum U2 (dibuat U1) diberi stepSnapshot dari data step saat migrasi. Nilai yang diisi atau diubah per DDCL (nilai variabel, lampiran yang diubah) disimpan di kolom lain milik U3 dan tidak pernah di stepSnapshot. IF step diedit, pasangan rollback-nya diganti, atau step dihapus THEN stepSnapshot semua item yang ada tidak diubah; hanya item yang dibuat sesudahnya memakai isi terbaru"
    violation_behaviour: Tidak berlaku sebagai penolakan; ini invarian: tidak ada jalur kode Library yang menulis ke stepSnapshot.
    source: AC1.2.2, AC1.3.3, FR2.4, Q6

  - id: BR2.9
    statement: Pasangan rollback hanya untuk step forward, menunjuk step rollback yang ada, dan bisa dibuat langsung dalam alur yang sama.
    category: validation
    applies_to: Step
    trigger: Permintaan membuat atau mengubah step forward dengan pairedRollbackStepId atau rollbackStep
    logic: "IF pairedRollbackStepId terisi pada step ber-kind rollback ATAU menunjuk step yang tidak ada ATAU menunjuk step ber-kind forward ATAU menunjuk dirinya sendiri THEN tolak dengan 400. IF permintaan membawa rollbackStep baru (isi lengkap step rollback) THEN buat step rollback itu dan tetapkan sebagai pasangan dalam satu transaksi, gagal semua atau berhasil semua. IF pasangan diganti atau dikosongkan THEN hanya step itu yang berubah (lihat BR2.8)"
    violation_behaviour: Permintaan ditolak 400; tidak ada step tersimpan sebagian.
    source: AC1.3.1, AC1.3.3, FR4

  - id: BR2.10
    statement: Step forward tanpa pasangan rollback ditandai di Library.
    category: policy
    applies_to: Step
    trigger: Daftar step ditampilkan
    logic: "IF kind = forward DAN pairedRollbackStepId null THEN daftar menampilkan penanda Belum ada rollback pada step itu. Penanda di bagian Rollback & Recovery Plan sebuah DDCL adalah cakupan u3-ddcl-composition"
    violation_behaviour: Tidak berlaku; penanda tampilan, bukan penolakan.
    source: AC1.3.2

  - id: BR2.11
    statement: Bundle berisi step forward berurutan dan rangkaian step rollback berurutan, dengan jumlah yang boleh berbeda.
    category: validation
    applies_to: StepBundle, BundleForwardMember, BundleRollbackMember
    trigger: Permintaan membuat atau mengubah bundle
    logic: "IF name bundle kosong ATAU sama dengan bundle lain (tanpa membedakan huruf besar/kecil, spasi ujung dibuang) ATAU tidak ada anggota forward ATAU anggota forward bukan step ber-kind forward ATAU anggota rollback bukan step ber-kind rollback ATAU step yang sama muncul dua kali dalam daftar yang sama THEN tolak dengan 400 (409 untuk nama sama) dan sebutkan penyebabnya. Jumlah anggota rollback tidak harus sama dengan jumlah anggota forward. Posisi anggota dirapatkan dari 1. Menghapus bundle hanya menghapus bundle dan keanggotaannya, bukan step-nya"
    violation_behaviour: Permintaan ditolak; tidak ada bundle tersimpan sebagian.
    source: Q11 (permintaan pengguna: bundle step terhubung ke rangkaian step rollback dengan jumlah berbeda)

  - id: BR2.12
    statement: Kategori adalah daftar tetap Database, Bastion, RabbitMQ, Keycloak dan hanya berfungsi sebagai label pengelompokan.
    category: constraint
    applies_to: Step, StepBundle
    trigger: Permintaan daftar kategori (GET /api/v1/steps/categories) atau pemilihan kategori di form
    logic: "IF daftar kategori diminta THEN kembalikan keempat nama tanpa daftar isian per kategori. Kategori tidak mengubah isian yang diminta (lihat BR2.4); ia dipakai untuk pengelompokan, filter, dan keunikan nama (BR2.3)"
    violation_behaviour: Kategori di luar daftar ditolak 400 (BR2.1).
    source: FR2.1, AC1.1.3, Q4, Q10

  - id: BR2.13
    statement: Daftar Library bisa dicari berdasarkan nama dan difilter berdasarkan kategori.
    category: calculation
    applies_to: Step, StepBundle
    trigger: Permintaan daftar step atau bundle dengan parameter q atau category
    logic: "IF q diisi THEN kembalikan hanya yang namanya memuat q (tanpa membedakan huruf besar/kecil). IF category diisi THEN kembalikan hanya yang kategorinya sama. IF keduanya diisi THEN keduanya berlaku. Penyaringan dilakukan di server. IF tidak ada yang cocok THEN daftar kosong, bukan error"
    violation_behaviour: Parameter category di luar daftar dijawab 400.
    source: Q8, design-system-mapping.md (kategori komponen Search / filter input)

  - id: BR2.14
    statement: Rangkaian rollback sebuah bundle berdiri sendiri; pasangan rollback per step tidak harus ada di dalamnya.
    category: policy
    applies_to: StepBundle, Step
    trigger: Bundle dibaca untuk dipasang ke DDCL (GET /api/v1/bundles/{id}), atau step dipasang sendirian
    logic: "IF sebuah bundle dibaca THEN respons memuat anggota forward berurutan dan anggota rollback berurutan, masing-masing dengan isi lengkap step (kolom, langkah, lampiran) dan pairedRollbackStepId bila ada, supaya U3 bisa memperluasnya menjadi item checklist dengan snapshot per step (BR2.8). Sumber rollback: IF step dipasang sendirian THEN rollback-nya adalah pasangan per step (BR2.9); IF bundle dipasang THEN rollback-nya adalah rangkaian rollback bundle, dalam urutan seperti disimpan (tidak dibalik otomatis; pengguna menyusun urutan itu), dan pasangan per step dari anggota forward bundle tidak dipasang tambahan. Pasangan per step tidak wajib ada di rangkaian rollback bundle. Penanda Belum ada rollback (BR2.10) berlaku pada step forward yang dipasang sendirian; untuk bundle, penandanya adalah rangkaian rollback yang kosong"
    violation_behaviour: Tidak berlaku sebagai penolakan; ini aturan sumber data yang dibaca U3.
    source: Q11 (permintaan pengguna: bundle terhubung ke step rollback dengan jumlah berbeda), AC2.3.1 (kontrak data untuk U3)
```

## Ringkasan Aturan

| ID | Kategori | Berlaku untuk | Pernyataan singkat |
|---|---|---|---|
| BR2.1 | validation | Step | Nama, kategori sah, jenis, dan minimal satu langkah wajib |
| BR2.2 | policy | StepColumn, StepLine | Form baru 3 kolom, kolom bisa ditambah/dikurangi, minimal satu |
| BR2.3 | constraint | Step | Nama sama per kategori ditolak 409, tawarkan step yang ada dengan perbandingan |
| BR2.4 | calculation | StepLine, Step | Variabel {nama} diturunkan dari teks; tanpa daftar isian tetap per kategori |
| BR2.5 | validation | StepAttachment | Lampiran teks, nama unik tanpa path, ukuran dibatasi |
| BR2.6 | calculation | Step, ChecklistItem | usageCount dihitung di lapisan endpoint |
| BR2.7 | policy | Step, ChecklistItem, StepBundle | Hapus step selalu boleh; DDCL lama tidak berubah |
| BR2.8 | constraint | ChecklistItem, Step | Snapshot step saat dipasang; Library tidak menulis ke snapshot |
| BR2.9 | validation | Step | Pasangan rollback hanya forward ke rollback; bisa dibuat inline atomik |
| BR2.10 | policy | Step | Penanda Belum ada rollback di Library |
| BR2.11 | validation | StepBundle | Bundle forward berurutan + rollback berurutan, jumlah boleh beda |
| BR2.12 | constraint | Step, StepBundle | Kategori daftar tetap, hanya label |
| BR2.13 | calculation | Step, StepBundle | Cari nama dan filter kategori di server |
| BR2.14 | policy | StepBundle, Step | Rollback bundle berdiri sendiri; sumber rollback dan urutannya ditetapkan untuk U3 |

## Assumptions & Open Questions

- [open] BR2.14 menetapkan sumber rollback, urutan, dan bentuk data bundle untuk U3 dari penafsiran jawaban Q11; U3 menanyakan ulang ke pengguna saat Functional Design U3 sebelum membangun pemasangan bundle ke DDCL.
