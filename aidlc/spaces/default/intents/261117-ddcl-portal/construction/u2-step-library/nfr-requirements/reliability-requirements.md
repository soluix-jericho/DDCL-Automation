# NFR Requirements — u2-step-library — Reliability

Sumber: `requirements.md` NFR3, NFR4, `rules.md` BR2.7, BR2.8, BR2.9, jawaban `nfr-requirements-questions.md` Q5.

## Ketersediaan

| ID | Requirement |
|---|---|
| NFR3.4 | Library berjalan sepenuhnya lokal di Docker Compose tanpa layanan eksternal (NFR3 dari U1). Tidak ada target ketersediaan (SLA/SLO) untuk v1; tidak ada replikasi atau failover. |

## Integritas Data dan Toleransi Kegagalan

| ID | Requirement |
|---|---|
| NFR4.3 | Setiap perubahan Library yang menyentuh lebih dari satu baris berjalan dalam satu transaksi database: simpan step beserta kolom, langkah, lampiran, dan pasangan rollback (termasuk pembuatan rollback inline); hapus step beserta pengosongan pasangan, keluarnya dari bundle, penghapusan bundle yang kehilangan anggota forward terakhir, dan pengosongan `stepId` di item checklist; simpan bundle beserta anggotanya. Gagal di tengah berarti tidak ada yang berubah. |
| NFR4.4 | Menghapus atau mengubah step tidak pernah mengubah `stepSnapshot` item checklist mana pun (BR2.8). Test otomatis membuktikannya. |
| NFR4.5 | Setiap pelanggaran batasan database dipetakan ke kode HTTP yang pasti dan tidak pernah menjadi 500: keunikan nama step (kode Prisma `P2002` pada indeks nama) menjadi 409 dengan isi step yang sudah ada dan `conflictOn` (BR2.3); keunikan nama bundle menjadi 409 dengan isi bundle yang sudah ada (BR2.11); pelanggaran foreign key karena step yang dirujuk (pasangan rollback, anggota bundle, snapshot) baru dihapus bersamaan (`P2003`) menjadi 404 yang menyebut step itu (BR2.8). Pelanggaran batasan posisi tidak boleh terjadi sama sekali berkat penguncian baris di `scalability-requirements.md` (Konkurensi); bila terjadi, itu bug dan dicatat sebagai error. Permintaan yang kalah berlomba mendapat salah satu kode di atas. |
| NFR4.6 | Hapus step yang sudah tidak ada menjawab 404, bukan 500 (BR2.7). |
| NFR4.7 | Keunikan nama tanpa membedakan huruf besar/kecil dan dengan spasi ujung dibuang diwujudkan sebagai indeks unik fungsional `(lower(trim(name)), category, kind)` untuk step dan `lower(trim(name))` untuk bundle, lewat migrasi SQL mentah di Prisma; tidak cukup dengan `@@unique` biasa. |

## Backup dan Pemulihan

Data ada di volume PostgreSQL Docker Compose (NFR4); backup di luar cakupan v1 sebagaimana U1.

## Degradasi

Jika database tidak terjangkau, API menjawab error generik tanpa detail ke klien, rincian di log server (BR1.5 dari U1); layar Library menampilkan pesan gagal dan tombol coba lagi, tanpa kehilangan isi form yang sedang diketik.

## Assumptions & Open Questions

None.
