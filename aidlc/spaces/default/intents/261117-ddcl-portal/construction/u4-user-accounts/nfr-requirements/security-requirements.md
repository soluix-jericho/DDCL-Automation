# NFR Requirements — u4-user-accounts — Security

Sumber: `requirements.md` NFR2, U1 `security-requirements.md` (NFR2.1–NFR2.5) dan U2 (NFR2.6–NFR2.9), `rules.md` BR4.1–BR4.20, `functional-spec.md`, `aidlc/spaces/default/memory/phases/construction.md` ## Security, jawaban `nfr-requirements-questions.md` Q1, Q3, Q4, Q5, Q7, hasil review Functional Design (`functional-design/reviews/review-02.md`).

NFR2.2 dan NFR2.6 (belum ada validasi sesi di U1 dan U2) dicabut oleh Unit ini: mulai U4 semua endpoint `/api/v1/*` wajib sesi valid.

## Autentikasi dan Sesi

| ID | Requirement |
|---|---|
| NFR2.20 | Kata sandi minimal 10 dan maksimal 128 karakter, disimpan hanya sebagai hash scrypt (N=32768, r=8, p=1, dengan batas memori `maxmem` dinaikkan eksplisit menjadi 64 MiB karena nilai bawaan Node menolak N=32768; terukur sekitar 122 ms) dengan garam acak per akun, dibandingkan dengan perbandingan waktu-konstan; email tidak terdaftar tetap menghitung satu hash tiruan (BR4.2). Parameter disimpan bersama hash sehingga bisa dinaikkan nanti tanpa membuat hash lama tidak terbaca. |
| NFR2.21 | Token sesi 256 bit dari generator acak kriptografis; database hanya menyimpan SHA-256-nya (`tokenHash`, unik, berindeks). Masa berlaku 8 jam diam dan 7 hari mutlak (BR4.6). |
| NFR2.22 | Cookie `ddcl_session`: httpOnly, SameSite=Lax, path `/`. Atribut Secure ditentukan variabel lingkungan `COOKIE_SECURE` (bawaan `false` di Compose lokal, `true` bila dilayani lewat HTTPS). |
| NFR2.23 | Pembawa sesi yang diterima hanya cookie `ddcl_session` dan header `Authorization: Bearer <sessionToken>`; Bearer dipakai bila keduanya ada (BR4.5, BR4.6, Q7 B). Preflight `OPTIONS` dikecualikan dari pemeriksaan sesi dan role; `HEAD` diperlakukan seperti `GET`. |
| NFR2.24 | Penguncian login: 5 percobaan gagal beruntun (login atau kata sandi lama pada ganti kata sandi) untuk satu email mengunci email itu 15 menit, dijawab 429 dengan `Retry-After`; penghitung ditulis dalam transaksi database (BR4.4). Percobaan ke-5 yang gagal tetap dijawab seperti kegagalan biasa (401 pada login, 400 pada ganti kata sandi); percobaan berikutnya selama terkunci dijawab 429. |
| NFR2.25 | Pemeriksaan Origin pada rute tulis yang diautentikasi lewat cookie atau tanpa sesi memakai daftar `ALLOWED_ORIGINS` (daftar yang sama untuk CORS); permintaan Bearer melewati pemeriksaan ini (BR4.15, Q14). Variabel `ALLOWED_ORIGINS` yang kosong membuat backend gagal start (tidak ada bawaan terbuka). |
| NFR2.26 | `ADMIN_EMAIL` dan `ADMIN_PASSWORD` (opsional `ADMIN_NAME`) hanya dibaca saat tabel `User` kosong; nilainya tidak pernah dicatat di log atau audit, dan backend gagal start bila diperlukan tetapi tidak sah (BR4.11). Kredensial tetap lewat environment variable (NFR2.3 U1). |

## Otorisasi dan Role

| ID | Requirement |
|---|---|
| NFR2.27 | Role dibaca dari `User` di database pada setiap permintaan (BR4.9). Rute tanpa deklarasi role minimal dianggap membutuhkan admin. Role minimal rute U1–U3 yang berlaku adalah tabel di bawah; tabel ini menggantikan tabel rute-ke-role di `functional-spec.md` (yang menyebut semua `DELETE` admin dan belum mencantumkan lock, submit, versions, capture-notes sehingga bertentangan dengan matriks hak dan Contract 3). Code Generation mendaftar setiap rute nyata dan mencocokkannya dengan tabel ini. |

| Rute | Role minimal |
|---|---|
| Semua `GET` Library dan DDCL (daftar, detail, riwayat, rekap) dan `GET /ddcls/{id}/export` | viewer |
| `POST`/`PATCH`/`PUT` Library (step, bundle) dan DDCL (buat, ubah, checklist item, header, urutan) | editor |
| `POST /ddcls/{id}/lock`, `POST /ddcls/{id}/submit`, `POST /ddcls/{id}/versions`, `POST /ddcls/{id}/capture-notes` (rute U3) | editor |
| `DELETE /ddcls/{id}/lock` dan `DELETE` checklist item (melepas lock dan menghapus baris adalah bagian mengedit) | editor |
| `DELETE /steps/{id}`, `DELETE /bundles/{id}`, `DELETE /ddcls/{id}` (hapus permanen; tidak ada operasi arsip di kontrak, jadi hak "hapus atau arsip" matriks berarti hapus) | admin |
| `GET /health`, `POST /auth/login`, preflight `OPTIONS` | tanpa sesi |
| `GET /auth/me`, `POST /auth/logout`, `POST /auth/password` | viewer (semua role) |
| `GET/POST /users`, `PATCH /users/{id}`, `POST /users/{id}/password`, `POST /users/{id}/unlock`, `GET /audit-events` | admin |

Admin yang memanggil `POST /users/{id}/password` untuk akunnya sendiri dijawab 409 dengan petunjuk memakai ganti kata sandi (BR4.12), supaya kata sandi lama tetap diverifikasi.

## Validasi Input dan Perlindungan Data

| ID | Requirement |
|---|---|
| NFR2.28 | Semua input U4 divalidasi dengan skema Fastify di batas sistem: email maksimal 254 karakter, nama 1–100, kata sandi 10–128, role dan status dari enum, `detail` audit maksimal 500, filter audit (jenis dari enum, tanggal ISO, ukuran halaman 1–100) yang tidak sah dijawab 400 yang menyebut field-nya. Akses database hanya lewat Prisma (kueri berparameter). |
| NFR2.29 | Respons dan log tidak pernah memuat `passwordHash`, `tokenHash`, token, kata sandi, atau isi cookie (BR4.17). `AuditEvent.email` dibatasi 254 karakter. |
| NFR2.30 | Pertumbuhan catatan audit dari jalur tanpa autentikasi dibatasi. Aturan ini menyempurnakan `functional-spec.md` W2 langkah 7 dan BR4.20 (yang mencatat semua hasil login) dan berlaku sebagai pengganti untuk bagian itu: tabel audit hanya menerima `login_failed` dan `login_locked` untuk email yang terdaftar; kegagalan dan penguncian pada email yang tidak terdaftar hanya masuk log. `login_locked` dicatat satu kali saat kunci ditetapkan, bukan pada setiap permintaan 429 sesudahnya. Dengan begitu penyerang tanpa autentikasi tidak bisa menambah baris tabel audit di luar jumlah akun terdaftar dikali 1 penguncian per 15 menit, dan asumsi 500.000 baris (NFR1.23) tetap berlaku. |
| NFR2.31 | Data akun tunduk pada kontrol akses NFR2 yang sama: PostgreSQL hanya di jaringan internal Docker Compose, tanpa masking data operasional (NFR2.3 sampai NFR2.5 U1 berlaku apa adanya). |

| NFR2.32 | Alamat IP yang dicatat di log dan audit adalah alamat koneksi langsung; header `X-Forwarded-For` hanya dipercaya bila variabel lingkungan `TRUST_PROXY` diaktifkan (bawaan nonaktif untuk Compose lokal). Kredensial CORS diizinkan hanya untuk origin di `ALLOWED_ORIGINS`, dengan header `Authorization` dan `Content-Type` yang diizinkan. |
| NFR2.33 | Banjir login dari satu sumber bisa memenuhi antrean hash dan membuat login sah menerima 503 (NFR1.24); ini diterima sebagai risiko DoS v1 karena portal hanya di jaringan internal dan di bawah 20 pengguna. Penahan: penguncian per email (NFR2.24), batas 4 hash bersamaan, dan penolakan cepat 503 yang tidak menahan sumber daya. Pembatasan per IP ditunda sampai hosting di luar jaringan internal. |

## Kepatuhan

Tidak ada kebutuhan kepatuhan regulasi baru. Catatan audit berisi email, alamat IP, dan id akun pegawai internal; retensi 1 tahun (NFR4.21) membatasi masa simpannya.

## Threat Considerations

- Tebak kata sandi: dilawan scrypt dan penguncian (NFR2.20, NFR2.24), termasuk jalur ganti kata sandi.
- Penguncian akun admin oleh orang yang tahu emailnya: dipulihkan lewat admin lain, layar Akun (BR4.18), atau skrip pemulihan di server (NFR3.22).
- CSRF: SameSite=Lax dan pemeriksaan Origin (NFR2.22, NFR2.25); permintaan Bearer tidak dikirim otomatis oleh browser.
- Pencurian token Bearer: token sama kuat dengan cookie tetapi tidak httpOnly di sisi klien yang menyimpannya; masa berlaku dan pencabutan (logout, penonaktifan, ganti kata sandi) tetap berlaku. Frontend memakai cookie dan tidak menyimpan token di penyimpanan browser.
- Pengguna menonaktifkan atau menurunkan semua admin: dicegah oleh BR4.13 dan BR4.14.

## Assumptions & Open Questions

None.
