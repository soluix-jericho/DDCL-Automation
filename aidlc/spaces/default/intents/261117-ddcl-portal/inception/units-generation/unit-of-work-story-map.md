# Units Generation — Story Map

Setiap baris dikunci dengan `USx.y` (mengikuti `stories.md`). Saat lebih dari satu Unit tercantum, keduanya bersama-sama menelusuri seluruh kriteria penerimaan baris tersebut (satu Unit membuktikan jalur dasarnya, Unit lain melengkapi sisanya) — lihat Unit ID & Directory di `unit-of-work.md`.

| Story | Unit(s) | Catatan urutan implementasi |
|---|---|---|
| US1.1 | U1 (u1-walking-skeleton); U2 (u2-step-library) | U1 membuktikan AC1.1.1 (jalur dasar: buat step, langsung terpasang) dan AC1.1.3 (satu kategori) untuk slice skeleton; U2 melengkapi AC1.1.2 (deteksi duplikat) dan AC1.1.3 untuk seluruh kategori. |
| US1.2 | U2 (u2-step-library) | Jumlah pemakaian step (AC1.2.1) dan penghapusan dengan snapshot DDCL lama tetap (AC1.2.2). |
| US1.3 | U2 (u2-step-library) | Penetapan/pengeditan pasangan rollback di Library (AC1.3.1–AC1.3.3). |
| US2.1 | U1 (u1-walking-skeleton); U3 (u3-ddcl-composition) | U1 membuktikan header minimal tersimpan; U3 melengkapi seluruh field dan validasi field wajib (AC2.1.2). |
| US2.2 | U1 (u1-walking-skeleton); U3 (u3-ddcl-composition) | U1 membuktikan satu step tersusun; U3 melengkapi reorder (AC2.2.2) dan duplikasi baris step yang sama (AC2.2.3). |
| US2.3 | U3 (u3-ddcl-composition) | Rollback otomatis terpasang mengikuti pasangan step forward dari Library (butuh U2 selesai lebih dulu). |
| US2.4 | U3 (u3-ddcl-composition) | Checklist Capture opsional. |
| US3.1 | U3 (u3-ddcl-composition) | Tandai "Sudah Dikirim", jadi read-only. |
| US3.2 | U3 (u3-ddcl-composition) | Buat versi baru (vN) dari DDCL yang sudah terkirim. |
| US4.1 | U1 (u1-walking-skeleton); U6 (u6-excel-export-hardening) | U1 membuktikan AC4.1.1/AC4.1.2 (ekspor dasar + data apa adanya) untuk satu DDCL minimal; U6 melengkapi AC4.1.3 (validasi), AC4.1.4 (overflow baris), AC4.1.5 (sanitasi formula-like). |
| US5.1 | U5 (u5-portal-reporting) | Rekap daftar semua DDCL. |
| US5.2 | U5 (u5-portal-reporting) | Filter status/tanggal dan pencarian judul. |
| US6.1 | U3 (u3-ddcl-composition) | Lock saat diedit + pelepasan otomatis. |
| US6.2 | U4 (u4-user-accounts) | Multi-akun pengguna dan autentikasi nyata. |

## Rows spanning multiple Units (cross-cutting)

- **US1.1**, **US2.1**, **US2.2**, **US4.1**: dibagi antara U1 (jalur dasar/skeleton) dan Unit yang melengkapi fitur penuhnya (U2, U3, atau U6) — lihat kolom Catatan di atas.

## Coverage Verification

- Seluruh 14 `USx.y` dari `stories.md` tercantum di atas, masing-masing dengan status `OK` di `traceability.json`.
- Setiap 6 Unit (U1–U6) muncul pada setidaknya satu baris: U1 (US1.1, US2.1, US2.2, US4.1), U2 (US1.1, US1.2, US1.3), U3 (US2.1, US2.2, US2.3, US2.4, US3.1, US3.2, US6.1), U4 (US6.2), U5 (US5.1, US5.2), U6 (US4.1).
