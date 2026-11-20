# NFR Design — u1-walking-skeleton — Security Design

Sumber: `nfr-requirements/security-requirements.md` (NFR2.1–2.5), jawaban `nfr-design-questions.md` Q3, Q4.

## Arsitektur Autentikasi/Otorisasi

Satu middleware Fastify (`onRequest` hook), dipasang di semua route sejak Unit ini, yang untuk U1 hanya membaca/menetapkan cookie HTTP-only berisi nilai stub tetap dan **tidak pernah menolak request** (jawaban Q3). Ini adalah titik pemasangan yang sama yang akan dipakai u4-user-accounts: U4 mengganti isi middleware ini menjadi validasi sesi nyata (menolak dengan 401 jika sesi tidak valid), tanpa memindahkan titik pemasangan atau mengubah bentuk route yang sudah ada.

```
Request masuk
  -> onRequest hook (middleware sesi)
       U1: baca/tetapkan cookie stub, selalu lanjut (tidak ada penolakan)
       U4 (nanti): validasi sesi nyata, tolak 401 jika tidak valid
  -> Route handler (POST /steps, POST /ddcls, dst.)
```

Cookie stub ditetapkan ke nilai yang sama secara tekstual dengan konstanta `createdBy` (`"dev-user"`), semata sebagai penanda bahwa keduanya mewakili identitas dev-mode yang sama — tapi route handler TIDAK membaca `createdBy` dari cookie ini. `createdBy` tetap literal konstan yang ditulis langsung di kode route handler, persis seperti yang ditetapkan `entities.md` dan `rules.md` BR1.3 ("konstanta, bukan foreign key"); dokumen Functional Design itu tetap satu-satunya sumber kebenaran untuk logika `createdBy` dan tidak diubah oleh keputusan ini. Middleware sesi dan penulisan `createdBy` adalah dua jalur kode yang terpisah di U1 — keduanya kebetulan memakai literal yang sama, bukan satu membaca dari yang lain. Saat U4 mengganti isi middleware menjadi validasi sesi nyata, U4 JUGA mengganti route handler supaya `createdBy` mulai dibaca dari identitas sesi yang divalidasi (bukan literal) — perubahan itu tercatat sebagai pekerjaan U4 di `unit-of-work.md`, bukan sesuatu yang U1 sudah desain sebelumnya.

## Enkripsi

Tidak ada TLS/enkripsi transit untuk v1 (jawaban Q4) — seluruh trafik backend↔frontend↔database berada di jaringan internal Docker Compose, tidak diekspos ke jaringan publik (NFR2.4). Tidak ada enkripsi tambahan pada data yang disimpan di luar yang disediakan volume Docker lokal.

## Input Validation

Validasi field wajib (BR1.1 — `name`, `category` pada Step) dilakukan di lapisan skema route Fastify (validasi JSON Schema bawaan Fastify), bukan hanya di lapisan Prisma — sehingga permintaan tidak valid ditolak sebelum mencapai database (400, sesuai `rules.md` BR1.1).

## Data Masking

Tidak ada lapisan masking di jalur manapun (API response, Excel export) — data operasional (host, database, image) ditulis/dikembalikan apa adanya di setiap titik (NFR2.5), sesuai `requirements.md` FR7.1/NFR2 yang sudah mengonfirmasi data operasional tidak memerlukan masking. Tidak ada kode atau konfigurasi masking untuk dihapus atau dinonaktifkan karena memang tidak pernah ditambahkan.

## Security Headers

Tidak ada kebutuhan header keamanan khusus untuk v1 (tidak ada browser pihak ketiga yang mengakses API ini di luar frontend internal yang sama — CORS dibatasi ke origin frontend Docker Compose).

## Secrets Management

Kredensial database dimuat dari environment variable (`DATABASE_URL`) yang disuntikkan Docker Compose saat startup (NFR2.3) — tidak pernah ditulis di kode sumber atau file yang masuk version control.

## Audit Logging

Tidak ada audit log keamanan khusus untuk v1 — log error integration boundary (lihat `observability-design.md`) sudah mencatat kegagalan yang relevan untuk skala skeleton ini.

## Compliance Controls

Tidak berlaku — tidak ada kebutuhan kepatuhan regulasi untuk v1 (`security-requirements.md`).

## Assumptions & Open Questions

None.
