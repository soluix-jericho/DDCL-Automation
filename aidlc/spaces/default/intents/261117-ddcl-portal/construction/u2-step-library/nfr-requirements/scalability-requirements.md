# NFR Requirements — u2-step-library — Scalability

Sumber: `requirements.md` NFR1, NFR4, jawaban `nfr-requirements-questions.md` Q3 dan Q5.

## Proyeksi Beban dan Data

| ID | Requirement |
|---|---|
| NFR1.9 | Library dirancang untuk sampai 1.000 step dan 100 bundle, dengan kurang dari 20 pengguna aktif bersamaan (Q3). Di atas itu, v1 tidak menjamin target NFR1.5. |
| NFR4.2 | Data Library tumbuh tanpa penghapusan otomatis (NFR4); penghapusan hanya lewat aksi pengguna (BR2.7). Batas atas teoretis per step sekitar 5 MB (NFR1.10); 1.000 step di batas maksimum berarti sekitar 5 GB, tetapi step nyata (puluhan baris teks dan beberapa lampiran kecil) diperkirakan di bawah 100 KB, sehingga Library sekitar 100 MB. Pertumbuhan yang lebih besar ada di `stepSnapshot`, yang menyalin penuh step ke setiap item checklist (BR2.8): 100.000 item × sekitar 100 KB = sekitar 10 GB di batas atas asumsi NFR1.5. Keduanya masih dalam kapasitas disk PostgreSQL lokal; bila pemantauan disk nyata mendekati batas, tinjau ulang di versi berikutnya. |

## Pemicu Peningkatan Skala

- Jika data nyata mendekati 1.000 step atau pencarian melewati 1 detik, tambahkan indeks (mis. `pg_trgm` pada nama) lewat migrasi Prisma. Ditunda sengaja (Q3).
- Daftar step memakai satu kueri dengan agregasi `usageCount` dan mengembalikan ringkasan (NFR1.11); paginasi ditambahkan hanya bila jumlah baris melampaui asumsi 1.000 step. Jika `usageCount` melambat dengan bertambahnya item checklist, tambahkan indeks pada `ChecklistItem.stepId`.

## Konkurensi

Perubahan bersamaan atas step yang sama: yang terakhir menyimpan menang (Q5), dan hasil akhirnya persis satu salinan utuh dari penyimpan terakhir. Mekanismenya: setiap transaksi tulis atas sebuah step (PATCH, DELETE, simpan bundle yang memuatnya) mengunci baris `Step` dengan `SELECT ... FOR UPDATE` di awal transaksi, sehingga tulis bersamaan berjalan berurutan; PATCH mengganti seluruh kolom, langkah, dan lampiran (hapus lalu isi ulang) dalam transaksi yang sama, jadi batasan posisi `(stepId, position)` dan `(columnId, position)` tidak pernah bentrok. Kunci ini adalah cara mewujudkan "terakhir menang" yang dipilih di Q5, bukan deteksi konflik. Keunikan nama dijaga oleh indeks unik di database (409 sesuai NFR4.5).

## Assumptions & Open Questions

None.
