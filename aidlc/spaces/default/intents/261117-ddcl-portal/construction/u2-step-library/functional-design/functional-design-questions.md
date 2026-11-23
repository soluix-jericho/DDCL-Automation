# Functional Design — u2-step-library — Questions

## Sources

- [memory] `unit-of-work.md` U2: CRUD Step penuh (forward & rollback), validasi nama duplikat (AC1.1.2), form object/parameter per kategori (AC1.1.3), jumlah pemakaian step (AC1.2.1), hapus step dengan snapshot DDCL lama tetap (AC1.2.2), pasangan rollback (AC1.3.1–AC1.3.3), layar Library.
- [memory] `requirements.md` FR2, FR2.1–FR2.4, FR4: Library menyimpan step reusable dengan nama dan kategori object/parameter; step bisa dihapus tanpa mengubah DDCL lama (snapshot).
- [memory] U1 `entities.md`: `Step` (id, name, category, kind, pairedRollbackStepId) — U2 memperluas skema yang sama, bukan menggantinya.
- [desc] Permintaan pengguna saat sesi ini: isi step harus bisa seperti contoh di template Excel — satu judul tebal (mis. "Update Deployment CES") dengan langkah bernomor di bawahnya, plus kemungkinan kolom tambahan atau file/kode terlampir (mis. isi `ces-deployment.yaml`).
- [assumption] Teks langkah tetap di Library dan hanya nilai `{variabel}` yang diisi per DDCL; lampiran kode disimpan sebagai teks pada step. Belum dikonfirmasi — ditanyakan di Q1–Q3.

## Q1. [Produk] Bentuk isi sebuah step

Contoh dari template: judul "Update Deployment CES", lalu langkah 1–5 (buka Code Editor remote, buka direktori, timpa file, edit file, save). Saat ini sebuah step hanya punya nama dan kategori, jadi isi langkah belum bisa disimpan. Bagaimana isi step disimpan di Library?

- A. Judul + daftar langkah bernomor: pengguna menambah, menghapus, dan mengurutkan langkah satu per satu; nomor dibuat otomatis
- B. Judul + satu kotak teks bebas (pengguna mengetik nomor sendiri)
- C. Judul saja seperti sekarang; langkah ditulis di DDCL, bukan di Library
- X. Other (please specify)

[Answer]: A, nanti misal saya butuh colom ada tombol tambahkan gitu jadi misal judul + 1 kolom, ntar saya bisa tambahkan column gitu 

## Q2. [Produk] Nilai yang berubah-ubah di dalam langkah

Pada contoh, beberapa nilai berbeda tiap rilis: alamat host (`v.soluix-prod@10.56.1.65`), direktori (`/home/v.soluix-prod/bcas-prod-deployment/ces-prod`), nama file. Agar step bisa dipakai ulang, nilai seperti itu bisa ditulis sebagai `{host}`, `{direktori}`, `{file}` di teks langkah, lalu diisi pengguna saat step dipasang ke sebuah DDCL. Bagaimana menanganinya?

- A. Variabel dengan kurung kurawal di teks langkah (mis. `{host}`); isian per DDCL dibuat otomatis dari variabel itu, dan hasil ekspor Excel memakai nilai yang sudah diisi
- B. Tidak ada variabel; nilai ditulis apa adanya di teks langkah dan diedit per DDCL bila perlu
- X. Other (please specify)

[Answer]: A, untuk sekarng A dulu nanti saya ingin lihat hasilnya baru bisa saya simpulkan seperti apa

## Q3. [Produk] Lampiran file atau kode pada step

Langkah 3 pada contoh berbunyi "timpa file `ces-deployment.yaml` dengan yang terdapat pada doc DDCL", artinya isi file itu tersimpan di dokumen DDCL. Apakah sebuah step bisa membawa lampiran seperti itu?

- A. Ya: step punya nol atau lebih lampiran teks (nama file + isi, mis. yaml); isinya ikut ke DDCL saat step dipasang dan bisa diubah per DDCL
- B. Ya, tapi hanya berupa unggahan file (disimpan sebagai file, bukan teks)
- C. Tidak untuk U2; lampiran ditunda ke Unit lain
- X. Other (please specify)

[Answer]: A, ada beberapa case saya perlu menulis step2nya menruut saya jadi ada kemungkinan step yang baru saya tulis itu ada lampiran sendiri misal .yaml .sql .py dll gitu 

## Q4. [Produk] Kategori object/parameter

Kategori menentukan isian khusus apa yang muncul untuk sebuah step (mis. step Database menawarkan isian database saja, bukan semua isian tercampur — AC1.1.3). Kategori mana yang dibutuhkan di U2?

- A. Database (host, nama database, user), Server/Host (alamat, direktori), Image/Container (nama image, tag), File/Konfigurasi (nama file, path), dan Lainnya (isian bebas)
- B. Kategori yang berbeda dari daftar di atas (sebutkan nama kategori dan isiannya)
- X. Other (please specify)

[Answer]: kategory boleh sih, mungkin untuk sekarang Database, Bastion, RabbitMQ, Keycloak dulu saja 

## Q5. [Produk] Nama step yang sama (AC1.1.2)

Jika pengguna menyimpan step dengan nama yang sama persis dengan step yang sudah ada, sistem harus menawarkan memakai step yang sudah ada. Bagaimana nama dibandingkan, dan apa yang terjadi bila pengguna tetap ingin membuat step baru?

- A. Dibandingkan tanpa membedakan huruf besar/kecil dan abaikan spasi di ujung; sistem menawarkan "Pakai step yang sudah ada", dan pengguna tidak bisa membuat duplikat
- B. Seperti A, tapi pengguna tetap boleh membuat duplikat dengan konfirmasi "Buat tetap"
- X. Other (please specify)

[Answer]: A. boleh seperti itu atau ntar misal stepnya sama bisa di check kaya ada popup gitu step a seperti ini step b seperti ini

## Q6. [Produk] Mengubah step yang sudah dipakai DDCL

Aturan pasangan rollback (AC1.3.3) sudah jelas: DDCL lama tidak berubah. Apakah aturan yang sama berlaku untuk perubahan isi step (judul, langkah, variabel, lampiran)?

- A. Ya: setiap DDCL menyimpan salinan (snapshot) step saat dipasang; mengubah atau menghapus step di Library tidak mengubah DDCL lama, hanya DDCL baru
- B. Tidak: perubahan isi step ikut tampil di DDCL yang masih Draft, tapi tidak di DDCL yang sudah dikirim
- X. Other (please specify)

[Answer]: A, rollback nanti ada klasifikasinya misal ada di db 3 step bundle ntar ada step rollbacknya sperti apa gitu bisaga 

## Q7. [Desainer] Tampilan layar Library

Layar sekarang hanya HTML polos tanpa gaya. U2 menambah daftar step, jumlah pemakaian, hapus, dan pengelolaan pasangan rollback, jadi tampilannya perlu lebih layak. Pendekatan apa untuk gaya tampilan?

- A. Tailwind CSS dengan komponen sederhana buatan sendiri (tanpa pustaka komponen besar): ringan, mudah diubah saat review
- B. Pustaka komponen siap pakai (mis. MUI): cepat terlihat jadi, tapi menambah dependensi besar dan perlu dipasang
- C. CSS biasa minimal (satu berkas): tanpa dependensi baru
- X. Other (please specify)

[Answer]: A

## Q8. [Produk] Pencarian dan filter di Library

`design-system-mapping.md` menyebut Library butuh kolom cari/filter. Apakah masuk U2?

- A. Ya: kolom cari berdasarkan nama step dan filter berdasarkan kategori
- B. Tidak: daftar saja, pencarian ditunda
- X. Other (please specify)

[Answer]: A

## Q9. [Produk] Maksud "tambah kolom" pada step (tindak lanjut Q1)

Jawabanmu di Q1: judul + langkah bernomor, dan "nanti saya bisa tambahkan kolom" seperti judul + 1 kolom lalu menambah kolom. Supaya tidak salah tangkap, kolom di sini yang mana?

- A. Kolom tambahan berisi daftar langkah: sebuah step punya judul dan satu atau lebih kolom langkah, tiap kolom punya daftar langkah bernomor sendiri (kolom bisa ditambah/dihapus lewat tombol "Tambah kolom")
- B. Kolom tambahan berisi isian bebas bernama (mis. "Catatan", "PIC") di samping daftar langkah; tiap kolom punya nama dan satu nilai teks
- C. Maksudnya sama dengan lampiran di Q3 (tombol tambah untuk lampiran), tidak ada kolom lain
- X. Other (please specify)

[Answer]: A, jadi misal awal default hanya 3 kolom, ternyata sampe 5 , tar 2 lagi saya tambah manual gitu

## Q10. [Produk] Isian tiap kategori (tindak lanjut Q4)

Kategori yang dipilih: Database, Bastion, RabbitMQ, Keycloak. Isian (parameter) apa yang muncul untuk tiap kategori saat step dipasang ke DDCL? Usulan di bawah bisa kamu ubah.

- A. Database: host, port, nama database, user. Bastion: host, user, direktori kerja. RabbitMQ: host, port, vhost, nama queue/exchange. Keycloak: URL, realm, client id
- B. Isian berbeda dari usulan A (tuliskan isian per kategori)
- C. Isian diambil dari variabel `{...}` yang ditulis di langkah (Q2) saja, tanpa daftar isian tetap per kategori; kategori hanya label pengelompokan
- X. Other (please specify)

[Answer]: C, isian beda diambil dari apakah pada step ada variabel yang perlu diisi kalau gk ada gk perlu

## Q11. [Produk] Rollback per kelompok step (tindak lanjut Q6)

Di Q6 kamu menulis bahwa rollback nanti ada klasifikasinya, mis. di database ada bundle 3 step, lalu ada rollback untuk bundle itu. Rencana U2 sekarang: setiap step forward punya satu pasangan step rollback (AC1.3.1–AC1.3.3). Bagaimana dengan kelompok?

- A. U2 tetap pasangan per step (satu forward satu rollback). Kelompok atau bundle dengan rollback bersama dicatat sebagai kebutuhan untuk Unit penyusunan DDCL (U3) dan ditinjau ulang saat kamu review U3
- B. Ada "bundle step" di Library: beberapa step forward dikelompokkan, dan bundle punya satu rangkaian rollback sendiri (selain atau menggantikan rollback per step)
- C. Step bisa diberi label klasifikasi (mis. "DB") hanya untuk pengelompokan tampilan dan filter; rollback tetap per step
- X. Other (please specify)

[Answer]: X, mksd saya contoh saja database step dari buka db sampai run query kan itu misal ada 3 (kita buat 1 bundle), nah untuk step ini ntar langsung ke link dengan step rollback (misal ada 2 step rollback utnk 3 step imple awal)

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
