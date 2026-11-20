# NFR Design — u1-walking-skeleton — Questions

## Sources

- [memory] `nfr-requirements/*.md` (U1): target performa <2 detik, sesi cookie stub tanpa validasi, DB internal-only, error generik+log server, Fastify/Prisma/ExcelJS/React+Vite, tidak ada observability eksternal.
- [memory] `functional-spec.md`: alur linear 11 langkah, tanpa concurrency.
- [memory] `contract-summary.md`: REST/JSON, retry hanya GET idempotent, status HTTP standar.

## Q1. [Arsitek] Pola resiliensi untuk skala skeleton

Skala skeleton (satu pengguna, satu proses backend, panggilan database lokal) — apakah circuit breaker/bulkhead diperlukan, atau cukup try/catch + error generik (BR1.5) tanpa pola resiliensi tambahan?

- A. Cukup try/catch di setiap operasi database dan file I/O, tanpa circuit breaker/bulkhead — pola itu bernilai untuk panggilan jaringan ke layanan eksternal yang bisa gagal sebagian, sementara skeleton ini hanya punya satu dependensi lokal (PostgreSQL di Docker Compose yang sama) yang gagal/berhasil sebagai satu kesatuan
- B. Perlu pola resiliensi tambahan (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] Caching

- A. Tidak ada caching di skeleton ini — skala data (satu step, satu DDCL) dan target performa (<2 detik) tidak butuh caching; query Prisma langsung ke PostgreSQL cukup
- B. Perlu caching (sebutkan lapisan mana)
- X. Other (please specify)

[Answer]: A

## Q3. [Devsecops] Arsitektur autentikasi/otorisasi untuk skeleton (fondasi U4)

Mengikuti keputusan NFR Requirements (cookie HTTP-only sisi server, stub tetap untuk U1): bagaimana middleware sesi dirancang secara struktural supaya U4 tinggal mengisi logika validasi tanpa mengubah bentuknya?

- A. Satu middleware Fastify (`onRequest` hook) dipasang di semua route sejak U1, yang untuk U1 HANYA membaca/menetapkan cookie stub dan TIDAK menolak request apa pun (selalu lanjut) — U4 mengganti isi middleware ini menjadi validasi sesi nyata (menolak dengan 401 jika tidak valid) tanpa mengubah titik pemasangannya di route
- B. Arsitektur middleware lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Devsecops] Enkripsi data saat transit & saat disimpan

- A. Tidak ada TLS/enkripsi transit untuk v1 — seluruh trafik ada di jaringan internal Docker Compose yang sama, tidak diekspos ke jaringan publik (`security-requirements.md` NFR2.4); tidak ada enkripsi tambahan saat disimpan di PostgreSQL di luar yang disediakan Docker volume lokal
- B. Perlu enkripsi tambahan (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q5. [Ops] Desain logging terstruktur

- A. Logger bawaan Fastify (Pino) dikonfigurasi menulis JSON ke stdout, dengan field standar (timestamp, level, request id, path) — tidak ada correlation ID lintas-layanan (tidak relevan karena tidak ada layanan terdistribusi, `observability-requirements.md`)
- B. Desain logging lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q6. [Arsitek] Batas komponen logis & failure domain

- A. Satu failure domain: proses backend tunggal yang menampung StepLibrary, DdclDocument, dan ExcelExportService (seluruh skema `components.md`) — jika proses ini gagal, seluruh fitur skeleton ikut tidak tersedia; frontend adalah failure domain terpisah (gagal menampilkan UI tidak menjatuhkan backend, dan sebaliknya). Tidak ada shared resource selain satu database PostgreSQL yang sama.
- B. Pembagian failure domain lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
