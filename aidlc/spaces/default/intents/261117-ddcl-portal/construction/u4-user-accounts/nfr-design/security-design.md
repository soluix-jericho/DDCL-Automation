# NFR Design — u4-user-accounts — Security

Sumber: `nfr-requirements/security-requirements.md` (NFR2.20–NFR2.33), `rules.md` BR4.1–BR4.20, `functional-spec.md`, jawaban `nfr-design-questions.md` Q1–Q6, `aidlc/spaces/default/memory/phases/construction.md` ## Security.

## Arsitektur Penegakan (satu pintu masuk)

Semua rute `/api/v1/*` melewati satu rantai pemeriksaan yang dipasang sekali di pintu masuk backend, dalam urutan tetap. Rute tidak bisa melewatinya dan rute baru dari U3/U5/U6 otomatis ikut.

| Urutan | Langkah | Hasil bila gagal | NFR |
|---|---|---|---|
| 1 | Preflight `OPTIONS`, `/health`, dan `POST /auth/login` dikenali sebagai tanpa sesi | (lanjut ke rute, tetapi login tetap melewati langkah 2) | NFR2.23 |
| 2 | Pemeriksaan Origin untuk rute tulis, terhadap `ALLOWED_ORIGINS`; permintaan yang membawa header `Authorization: Bearer` melewatinya (kriterianya adalah keberadaan header itu, dinilai sebelum token divalidasi; token Bearer yang tidak sah tetap berakhir 401 di langkah 3, dan permintaan tanpa Bearer, termasuk yang berisi cookie, diperiksa) | 403 | NFR2.25 |
| 3 | Baca token: `Authorization: Bearer` lebih dulu, lalu cookie `ddcl_session`; hash SHA-256; satu kueri `Session` + `User` | 401 | NFR2.21, NFR2.23 |
| 4 | Validasi sesi: belum dicabut, diam ≤ 8 jam, umur ≤ 7 hari, `User.status = active` | 401 | NFR2.21 |
| 5 | Role pengguna terhadap role minimal rute | 403 | NFR2.27 |
| 6 | Rute berjalan dengan identitas dari sesi (klien tidak bisa menentukan pelaku) | — | BR4.16 |

Role minimal dideklarasikan pada konfigurasi rute (metadata rute) dan dibaca langkah 5; rute tanpa deklarasi dianggap admin. Tabel rute-ke-role yang berlaku adalah NFR2.27. Test memastikan setiap rute terdaftar punya deklarasi eksplisit atau sengaja bernilai admin (NFR5.20).

## Kata Sandi (NFR2.20)

- Hash scrypt N=32768, r=8, p=1, `maxmem` 64 MiB, garam acak 16 byte per akun. Parameter ikut tersimpan di nilai hash sehingga parameter bisa dinaikkan nanti dan hash lama tetap terbaca.
- Verifikasi memakai perbandingan waktu-konstan; untuk email tidak terdaftar, hash tiruan dihitung lewat pintu hash yang sama.
- Panjang 10–128 karakter diperiksa sebelum hash dihitung (menolak masukan sangat panjang sebelum memakai CPU).

## Penguncian (NFR2.24)

- `LoginThrottle` per email dinormalisasi. Baris dibuat bila belum ada dengan upsert (`INSERT ... ON CONFLICT DO NOTHING`) sehingga email tidak terdaftar pun punya baris yang bisa dikunci; lalu baris dikunci dengan `SELECT ... FOR UPDATE` (Q2 A). Seluruh waktu (`lockedUntil`, `lastSeenAt`, umur sesi) dibandingkan dengan jam database (`now()`), bukan jam proses backend.
- Urutan dua transaksi pendek, dengan hash di antaranya di luar transaksi (koneksi tidak dipegang selama hash):
  1. Transaksi A: upsert baris, kunci baris, bila `lockedUntil` masih di masa depan jawab 429 tanpa memeriksa kata sandi; bila tidak, selesai.
  2. Hash dan verifikasi lewat pintu hash.
  3. Transaksi B: upsert dan kunci baris lagi, **periksa ulang `lockedUntil`**. Bila kini terkunci (permintaan paralel menguncinya selama hash berjalan), jawab 429 walau kata sandi benar dan buang hasil verifikasi, tanpa menerbitkan sesi. Bila tidak terkunci: gagal → naikkan penghitung, tetapkan kunci 15 menit pada kegagalan ke-5 dan setel ulang penghitung; berhasil → kosongkan baris, terbitkan sesi.
  Dengan begitu paling banyak 5 kegagalan beruntun dan tidak ada permintaan yang berhasil setelah kunci ditetapkan, berapa pun jumlah tebakan paralel.
- Percobaan ke-5 yang gagal dijawab seperti kegagalan biasa (401 login, 400 ganti kata sandi); percobaan berikutnya selama terkunci dijawab 429 dengan `Retry-After` tanpa memeriksa kata sandi. Ganti kata sandi memakai urutan A, hash, B yang sama dengan baris email pengguna.
- Ganti kata sandi memakai penghitung yang sama (BR4.12); login berhasil dan pembukaan oleh admin mengosongkannya.

## Sesi, Cookie, dan Bearer (NFR2.21–NFR2.23)

- Token 32 byte acak dari generator kriptografis; hanya SHA-256 yang disimpan. Cookie: httpOnly, SameSite=Lax, path `/`, Secure sesuai `COOKIE_SECURE`.
- Bearer diterima sebagai pembawa setara; bila keduanya ada, Bearer dipakai. Frontend memakai cookie dan tidak menyimpan token (Q6 A).
- Pencabutan: logout, penonaktifan akun, penggantian kata sandi (sesi lain), pengaturan ulang oleh admin. Login baru yang membawa sesi valid mencabut sesi lama itu: rute login dikecualikan dari kewajiban sesi, tetapi `SessionService` membaca token (bila ada) secara opsional dan mencabutnya dalam transaksi B yang menerbitkan sesi baru (BR4.5).
- Penulisan `lastSeenAt` tidak ditunggu untuk menjawab; galatnya ditangkap dan dicatat sebagai peringatan, tidak pernah mengubah jawaban permintaan.
- CORS: kredensial diizinkan hanya untuk origin di `ALLOWED_ORIGINS`; header yang diizinkan `Authorization` dan `Content-Type`; `ALLOWED_ORIGINS` kosong membuat backend gagal start (NFR2.25, NFR2.32).
- Alamat IP untuk log dan audit adalah alamat koneksi langsung; `X-Forwarded-For` dipercaya hanya bila `TRUST_PROXY` aktif (bawaan nonaktif) (NFR2.32).

## Penjagaan Admin dan Akun (BR4.13, BR4.14, BR4.18, BR4.19)

- Penonaktifan dan penurunan role: transaksi yang mengunci semua baris `User` ber-role admin dan aktif dengan `SELECT ... FOR UPDATE ... ORDER BY id` (Q2 A; urutan kunci tetap menurut id agar dua transaksi tidak saling menunggu melingkar), lalu menilai keadaan akhir; bila database tetap melaporkan deadlock (kode 40P01), transaksi diulang satu kali sebelum dijawab 500; permintaan paralel berjalan berurutan dan yang menghabiskan admin ditolak 409.
- Perubahan ganda (role dan status dalam satu `PATCH`) dinilai terhadap keadaan akhir dan disimpan atomik.
- Admin yang memanggil atur ulang kata sandi untuk akunnya sendiri dijawab 409 dengan petunjuk memakai ganti kata sandi.

## Masukan, Respons, dan Rahasia (NFR2.26, NFR2.28, NFR2.29)

- Semua masukan divalidasi dengan skema Fastify di batas sistem (email ≤254, nama 1–100, kata sandi 10–128, role dan status dari enum, `detail` ≤500, filter audit dari enum atau tanggal ISO, halaman 1–100); akses database hanya lewat Prisma berparameter.
- Respons akun hanya memuat id, name, email, role, status, createdAt, lastLoginAt; `passwordHash`, `tokenHash`, token, dan kata sandi tidak pernah masuk respons, log, atau audit. Pencatat log memakai daftar penyaring (redaksi) pada field sensitif sebagai lapis kedua.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` hanya dibaca saat tabel `User` kosong dan tidak pernah dicatat.

## Catatan Audit (NFR2.29, NFR2.30)

- Peristiwa perubahan akun ditulis dalam transaksi yang sama dengan perubahannya (Q4 A). Peristiwa login dan logout ditulis setelah keputusan dengan upaya terbaik; kegagalannya dicatat di log tanpa mengubah jawaban ke klien.
- Tabel audit menerima `login_failed` dan `login_locked` hanya untuk email terdaftar; email tidak terdaftar hanya masuk log. `login_locked` ditulis satu kali saat kunci ditetapkan. Aturan ini menyempurnakan BR4.20 dan W2 langkah 7 (NFR2.30).
- `AuditEvent.email` ≤ 254 karakter.

## Kontrol Tambahan

| Kontrol | Desain | NFR |
|---|---|---|
| Data akun dan jaringan | PostgreSQL hanya di jaringan internal Compose, kredensial lewat environment variable, tanpa masking data operasional | NFR2.31 (mewarisi NFR2.3, NFR2.5 U1) |
| Pemulihan di luar portal | Skrip server memakai kode hash dan aturan yang sama; kata sandi hanya dari prompt tersembunyi atau stdin; menulis `AuditEvent` dengan pelaku kosong dan keterangan `recovery-script` | NFR3.22 |
| DoS login | Diterima sebagai risiko v1 (antrean hash dan 503); penahan: penguncian per email, 2 hash bersamaan, penolakan cepat; pembatasan per IP ditunda sampai di luar jaringan internal | NFR2.33 |

## Ancaman dan Penanganan

| Ancaman | Penanganan |
|---|---|
| Tebak kata sandi (login atau lewat sesi curian) | scrypt, penguncian 5/15 menit termasuk jalur ganti kata sandi |
| Penguncian admin oleh pihak lain | Admin lain buka kunci (layar Akun) atau skrip server |
| CSRF | SameSite=Lax, pemeriksaan Origin, Bearer tidak dikirim otomatis browser |
| Penghabisan admin | Transaksi dengan penguncian baris (BR4.13, BR4.14) |
| Kebocoran database | Token hanya berupa hash; kata sandi hash scrypt bergaram |
| Pembengkakan tabel audit dari luar | Email tidak terdaftar hanya masuk log (NFR2.30) |
| Pembengkakan `LoginThrottle` dari email acak tak terdaftar | Diterima sebagai risiko v1: upsert membuat satu baris per email yang dicoba; baris usang (tidak terkunci atau kunci lewat, dan `updatedAt` lebih dari 24 jam) dihapus per jam (NFR4.20), email dibatasi 254 karakter oleh validasi, dan portal hanya di jaringan internal; pembatasan per IP ditunda bersama NFR2.33 |

## Assumptions & Open Questions

None.
