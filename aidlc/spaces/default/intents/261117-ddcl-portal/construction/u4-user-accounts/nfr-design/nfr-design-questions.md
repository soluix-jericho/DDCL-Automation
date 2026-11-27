# NFR Design — u4-user-accounts — Questions

## Sources

- [memory] `nfr-requirements/` U4: NFR1.20–NFR1.25 (login p95 <1 s, tambahan sesi ≤50 ms, 2 hash bersamaan, antrean 5 detik → 503), NFR2.20–NFR2.33 (scrypt, token, cookie/Bearer, Origin, penguncian, tabel rute-ke-role, audit), NFR3.20–NFR3.27 (migrasi dua tahap, skrip pemulihan, audit), NFR4.20–NFR4.21 (pembersihan, retensi), NFR5.20 (test wajib).
- [memory] `functional-spec.md` dan `rules.md` BR4.1–BR4.20: alur W1–W11 dan mesin status.
- [memory] Review NFR Requirements: dua catatan Minor tersisa yang diselesaikan di tahap ini (sisa angka "4 hash" menjadi 2; cara menjalankan migrasi dua tahap dengan pembuatan admin di antaranya, termasuk instalasi baru tanpa DDCL lama dan tanpa `ADMIN_*`).
- [memory] Pola U2: penguncian baris dengan `SELECT ... FOR UPDATE` dalam transaksi, cadangan pra-migrasi lewat skrip, log JSON Fastify.
- [assumption] Backend berjalan sebagai satu instance di v1 (Docker Compose lokal). Belum dikonfirmasi.

## Q1. [Arsitek] Antrean hash kata sandi

NFR1.24: paling banyak 2 hash scrypt berjalan, sisanya antre, tunggu >5 detik dijawab 503.

- A. Penghitung dan antrean sederhana di dalam proses backend (maksimal 2 berjalan, antrean FIFO, batas tunggu 5 detik); `scrypt` asinkron bawaan Node di threadpool libuv (`UV_THREADPOOL_SIZE=8`)
- B. Hash dijalankan di `worker_threads` terpisah (isolasi lebih kuat dari event loop, lebih banyak kode dan memori)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] Penjagaan admin terakhir dan penghitung penguncian

BR4.13, BR4.14, BR4.4 mengharuskan pemeriksaan "admin aktif terakhir" dan penghitung 5 percobaan tidak bisa dilewati permintaan paralel.

- A. Transaksi dengan `SELECT ... FOR UPDATE` pada baris yang relevan (baris admin aktif; baris `LoginThrottle` per email), sama dengan pola U2
- B. Isolasi transaksi `SERIALIZABLE` dengan ulang otomatis bila bentrok
- X. Other (please specify)

[Answer]: A

## Q3. [Arsitek] Pencarian sesi di setiap permintaan

Target NFR1.21: tambahan ≤50 ms p95 untuk pemeriksaan sesi dan role.

- A. Satu kueri database per permintaan lewat indeks `tokenHash` (menggabungkan `Session` dan `User`); tanpa cache, sehingga pencabutan sesi dan perubahan role berlaku seketika (sesuai BR4.9, BR4.13)
- B. Cache dalam proses selama 30 detik; lebih sedikit kueri, tetapi pencabutan dan perubahan role bisa terlambat sampai 30 detik
- X. Other (please specify)

[Answer]: A

## Q4. [Arsitek] Cara menulis catatan audit

BR4.20: perubahan akun harus gagal bila audit gagal; login gagal tidak boleh mengubah jawaban 401.

- A. Peristiwa perubahan akun (buat, role, nonaktif, ganti/atur ulang kata sandi, buka kunci) ditulis dalam transaksi yang sama dengan perubahannya; peristiwa login/logout ditulis setelah keputusan dengan upaya terbaik (kegagalan hanya dicatat di log, jawaban ke klien tidak berubah)
- B. Semua peristiwa lewat antrean di memori yang ditulis belakangan (lebih cepat, tetapi bisa hilang bila backend mati mendadak)
- X. Other (please specify)

[Answer]: A

## Q5. [Arsitek] Menjalankan migrasi dua tahap (catatan review NFR)

Admin pertama dibuat oleh kode aplikasi (hash scrypt), sehingga pengisian `createdByUserId` tidak bisa menjadi satu migrasi Prisma bersama pembuatan tabel; `prisma migrate deploy` menerapkan semua migrasi yang menunggu sekaligus.

- A. Migrasi Prisma hanya membuat tabel dan kolom `createdByUserId` yang boleh kosong. Saat start, kode backend: (1) membuat admin pertama bila tabel `User` kosong, (2) dalam satu transaksi mengisi `createdByUserId` yang kosong dengan admin pertama lalu menjadikan kolom wajib dengan foreign key (idempoten, aman dijalankan ulang). Instalasi baru tanpa DDCL lama tetap menjalankan langkah (2) (tanpa baris yang diisi) dan wajib punya `ADMIN_*`; tanpa itu backend gagal start (BR4.11)
- B. Migrasi Prisma menambah kolom wajib dengan nilai bawaan sementara, lalu kode backend memperbarui baris lama; kolom tidak punya foreign key sampai admin ada (lebih sederhana tetapi memberi jendela data tanpa referensi valid)
- X. Other (please specify)

[Answer]: A

## Q6. [Arsitek/UI] Penanganan sesi di frontend

- A. Frontend memakai cookie sesi (tanpa menyimpan token di penyimpanan browser); peran dan identitas dimuat dari `GET /auth/me` sekali saat aplikasi dibuka dan disimpan di konteks React; setiap jawaban `401` dari API mana pun mengarahkan ke layar Login, dan `403` menampilkan pesan "tidak punya izin" tanpa keluar
- B. Seperti A, tetapi peran dimuat ulang tiap 5 menit dan saat jendela kembali aktif, supaya perubahan role oleh admin cepat terlihat di menu
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
