# NFR Requirements — u2-step-library — Security

Sumber: `requirements.md` NFR2, U1 `security-requirements.md` (NFR2.1–NFR2.5, tetap berlaku), `rules.md` BR2.1, BR2.4, BR2.5, `aidlc/spaces/default/memory/phases/construction.md` ## Security.

## Autentikasi & Sesi

| ID | Requirement |
|---|---|
| NFR2.6 | Endpoint Library baru dan yang diperluas (`/api/v1/steps`, `/api/v1/steps/categories`, `/api/v1/bundles`) mengikuti keadaan U1 (NFR2.2): belum memvalidasi sesi di Unit ini; penegakan sesi login adalah tanggung jawab u4-user-accounts lewat middleware tanpa mengubah bentuk kontrak. |

## Validasi Input & Lampiran

| ID | Requirement |
|---|---|
| NFR2.7 | Semua input Library (nama, kategori, jenis, langkah, label kolom, nama dan isi lampiran, anggota bundle) divalidasi di batas sistem dengan skema Fastify dan batas eksplisit NFR1.8 (label kolom, nama file, nama bundle, jumlah anggota bundle, dan panjang `q` termasuk); yang tidak sah ditolak 400 dengan menyebut field-nya, yang melebihi `bodyLimit` NFR1.10 ditolak 413. |
| NFR2.8 | Lampiran diperlakukan sebagai teks data, tidak pernah dieksekusi atau dievaluasi di server. Nama file tidak boleh memuat pemisah path atau `..` (BR2.5), sehingga tidak ada penulisan ke sistem file dari nama yang diberikan pengguna. Isi lampiran dan teks langkah dirender di frontend sebagai teks (React meng-escape secara default; tidak memakai `dangerouslySetInnerHTML`). |
| NFR2.9 | Akses database hanya lewat Prisma (kueri berparameter); parameter `q` untuk cari tidak pernah dirangkai ke string SQL mentah, dan karakter khusus `ILIKE` (`%`, `_`) hanya boleh cocok sebagai karakter literal. Implementasi dipilih berdasarkan test wajib: `q` = `%` atau `_` tidak boleh mengembalikan semua step; bila `contains` Prisma tidak meng-escape sendiri, escape manual ditambahkan. |

## Perlindungan Data & Infrastruktur

NFR2.3, NFR2.4, NFR2.5 dari U1 berlaku apa adanya: kredensial database lewat environment variable, PostgreSQL hanya di jaringan internal Docker Compose, data operasional tanpa masking. Tailwind dibangun saat build (tanpa CDN), sehingga frontend tidak memuat skrip atau gaya dari pihak ketiga saat berjalan.

## Kepatuhan

Tidak ada kebutuhan kepatuhan regulasi baru; Library hanya menyimpan teks instruksi operasional.

## Threat Considerations

- Tanpa validasi sesi (NFR2.6), U2 hanya aman di jaringan Docker Compose lokal, sama seperti U1 (batas cakupan di `unit-of-work.md`).
- Teks langkah dan lampiran berasal dari pengguna internal dan nantinya masuk file Excel (U6); U6 harus memperlakukan isi yang diawali `=`, `+`, `-`, `@` sebagai teks, bukan formula. Dicatat di sini sebagai syarat untuk U6, tidak dikerjakan di U2.

## Assumptions & Open Questions

None.
