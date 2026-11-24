# NFR Requirements — u2-step-library — Questions

## Sources

- [memory] `requirements.md` NFR1–NFR6 dan NFR U1 (`u1-walking-skeleton/nfr-requirements/`): stack sudah diputuskan (Fastify, Prisma, PostgreSQL, React + Vite, ExcelJS, log JSON ke stdout), sehingga U2 mewarisinya dan hanya menanyakan hal yang baru.
- [memory] `rules.md` BR2.5 (lampiran "ukuran dibatasi", angkanya ditetapkan di tahap NFR) dan BR2.13 (cari dan filter di server); `functional-spec.md` (Tailwind CSS diminta pengguna).

## Q1. [Arsitek] Batas ukuran lampiran per step

BR2.5 mewajibkan batas ukuran; angkanya belum ada. Lampiran berupa teks (.yaml/.sql/.py).

- A. **Maks 100 KB per lampiran, maks 10 lampiran per step** — cukup untuk skrip dan YAML tipikal, jauh di bawah batas body Fastify
- B. Batas lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] Batas ukuran isi step

- A. **Maks 10 kolom, 50 langkah per kolom, 2.000 karakter per langkah, nama step maks 200 karakter** — melindungi layar dan ekspor Excel dari input berlebihan
- B. Batas lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q3. [Arsitek] Skala Library dan cara cari

Skala v1: puluhan pengguna, ratusan DDCL per tahun.

- A. **Asumsi sampai 1.000 step dan 100 bundle; cari nama dengan `ILIKE` di PostgreSQL tanpa indeks khusus**; target daftar dan cari selesai <2 detik (NFR1). Indeks teks penuh ditunda sampai data nyata melampaui asumsi
- B. Skala atau cara cari lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Arsitek/Dev] Pengiriman Tailwind CSS

- A. **Tailwind v3 lewat PostCSS di build Vite** (devDependency `tailwindcss`, `postcss`, `autoprefixer` di frontend, tanpa CDN supaya tetap jalan lokal tanpa internet). Menambah paket butuh `npm install` yang saya jalankan setelah izinmu di Code Generation
- B. Tailwind lewat CDN (tanpa instal, tapi butuh internet dan tidak cocok produksi)
- X. Other (please specify)

[Answer]: A

## Q5. [Arsitek] Konsistensi data saat hapus dan edit step

- A. **Semua perubahan Library satu transaksi database (semua berhasil atau tidak sama sekali), tanpa penguncian tambahan; dua orang yang mengubah step yang sama bersamaan: yang terakhir menyimpan menang**, kecuali nama sama yang ditolak lewat keunikan di database (409). Cukup untuk <20 pengguna
- B. Perlu deteksi konflik edit (mis. versi/ETag) (jelaskan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
