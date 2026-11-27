## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-27T07:58:36Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | backend/src/accountRepository.ts > login() transaksi B dan changeOwnPassword() | Data `user` (hash, status) dibaca sebelum hash dihitung dan tidak dibaca ulang di transaksi B. Login yang memverifikasi kata sandi lama sambil admin menjalankan `resetPassword` (atau pengguna mengganti kata sandi sendiri) bisa menerbitkan sesi baru setelah `revokeAllForUser` selesai, sehingga sesi itu lolos dari pencabutan. Untuk akun yang dinonaktifkan dampaknya tertutup karena `findValidSession` memeriksa `status = active`. Celahnya hanya selama waktu hash (sekitar 100 ms sampai beberapa detik saat antrean HashGate penuh). | Di transaksi B, kunci baris User (`FOR UPDATE`) dan bandingkan `passwordHash` dengan yang diverifikasi; bila berubah, perlakukan sebagai gagal. Atau catat sebagai risiko yang diterima di dokumentasi keamanan. | New |
| R-02 | Minor | backend/src/throttleService.ts > lockState; backend/src/retention.ts | `lockState` menambah baris `LoginThrottle` untuk setiap email yang dikirim anonim, termasuk email tanpa akun, sebelum hash (jadi tanpa biaya CPU bagi penyerang). Tidak ada batas per IP atau per jumlah baris. Retensi baru menghapusnya setelah 24 jam, jadi tabel bisa membesar dalam jendela itu. Dampak kecil untuk skala portal internal. | Beri batas jumlah baris tanpa akun, atau catat sebagai batasan yang diketahui bersama alasan skalanya. | New |
| R-03 | Minor | backend/tests/u1/api.test.ts > test database tak tersedia untuk `POST /steps` | Penyesuaian U1 mengganti asersi `operation: 'createStep'` menjadi `operation: 'findSession'`. Jalur 500 saat database mati kini hanya menguji gerbang sesi, bukan lagi galat di dalam `createStep`. Jalur gerbang fail-closed (NFR3.20) memang terbukti, tetapi jalur galat DB di repositori Library tidak lagi diuji lewat API. Ini menyempitkan cakupan, bukan sekadar menyesuaikan. | Tambahkan satu test yang memakai sesi sah (mis. Prisma dengan koneksi yang gagal setelah gerbang) agar `createStep` tetap diuji, atau dokumentasikan penyempitan itu. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261117-ddcl-portal/construction/u4-user-accounts/code-generation/code-summary.md > Open issues; backend/tests/u2/stepsApi.test.ts | Test "step made of 4-byte characters" memakan sekitar 10 detik, sama dengan batas transaksi 10 detik, dan sudah pernah gagal 500 sekali pada gabungan dengan `writeLimiter`. Ini flaky yang diketahui dan bisa menggagalkan CI. Selain itu alur start-prod penuh di Compose (cadangan, migrasi, admin pertama, backfill) tidak dijalankan; hanya smoke test `node dist/server.js` yang dilaporkan. | Pantau atau turunkan beban test itu. Jalankan alur start-prod penuh pada database sekali pakai sebelum rilis. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `docker compose build backend frontend` | PASS (Built) | Image terbangun ulang. |
| `docker compose run --rm backend npx vitest run tests/u4` | PASS: 21 file, 231 test | Sama dengan klaim ringkasan kode. |
| `docker compose run --rm --no-deps frontend npx vitest run tests/u4` | PASS: 6 file, 42 test | Sama dengan klaim. |
| `docker compose run --rm backend npx vitest run tests/u1 tests/u2` | PASS: 18 file, 234 test | Regresi hijau; satu asersi U1 menyempit (lihat temuan Minor ketiga), asersi lain hanya diadaptasi ke login. |
| Pemeriksaan manifest | PASS | Semua path sumber yang berubah menurut `git status` ada di `source-manifest.json`. |
| Pemeriksaan `traceability.json` | PASS | Semua target ada di disk dan sesuai isi (gerbang, throttle, bootstrap, recovery, retensi). |

### Summary

Rantai penegakan sudah benar: satu `onRequest` hook, rute tak terdaftar bernilai admin, pemeriksaan Origin, token hanya disimpan sebagai SHA-256, protokol A-hash-B dengan jam database, penjaga admin terakhir dengan kunci berurutan, dan skrip pemulihan tanpa kata sandi di argumen. Test yang dijalankan hijau dan sama dengan klaim. Tidak ada temuan Critical atau Major, hanya empat catatan Minor, jadi READY.
