# Refined Mockups — Portal DDCL Otomatis

Mockup mid-fidelity (ASCII), menyempurnakan `wireframes.md` dengan elemen dari User Stories: pasangan rollback di Library (US1.3), tombol revisi DDCL (US3.2), badge lock (US6.1), dan modal peringatan ekspor (US4.1/AC4.1.3–5). Fokus desktop/laptop; WCAG 2.1 AA (`refined-mockups-questions.md` Q1, Q2, Q4).

## Sumber

- `wireframes.md`, `user-flow.md` (Rough Mockups)
- `stories.md` (User Stories): US1.1, US1.2, US1.3, US2.1–US2.4, US3.1, US3.2, US4.1, US5.1, US5.2, US6.1, US6.2
- `requirements.md`: FR1–FR10, NFR1–NFR6

## 1. Dashboard / Portal Reporting

### Success / Populated State (dengan badge lock — US6.1)

```
+----------------------------------------------------------------------+
| [Logo] Portal DDCL        Dashboard | Library Step & Object    [User]|
+----------------------------------------------------------------------+
| <h1> Rekap DDCL                                    [+ Buat DDCL Baru]|
+----------------------------------------------------------------------+
| Filter: [Status v] [Tanggal v] [Cari...........]                     |
+----------------------------------------------------------------------+
| Judul DDCL         | Dibuat oleh | Tgl Dibuat | Tgl Dikirim | Status  |
|---------------------|-------------|------------|-------------|--------|
| DDCL BCAS PROD...    | Budi        | 2026-11-01 | 2026-11-03  | Dikirim|
| DDCL BCAS PROD...v2  | Budi        | 2026-11-05 | -           | [Draft] [lock] Sedang diedit oleh Budi |
| DDCL XYZ PROD...     | Sari        | 2026-11-10 | -           | Draft  |
+----------------------------------------------------------------------+
|                                      << 1 2 3 >>  Menampilkan 1-20/47 |
+----------------------------------------------------------------------+
```
Catatan: baris versi (v2, v3, ...) ditampilkan sebagai baris tersendiri dengan judul yang menyertakan "vN", bukan dikelompokkan — keputusan tampilan ini dicatat sebagai open question lanjutan untuk Functional Design (lihat `requirements-analysis/memory.md`).

Accessibility: badge "[lock] Sedang diedit oleh Budi" bukan hanya warna — selalu disertai ikon gembok + teks nama pengguna (lihat `accessibility-checklist.md`).

## 2. Editor DDCL — Langkah 1: Release Document

(Tidak berubah dari `wireframes.md` Bagian 2 — lihat dokumen itu untuk detail wizard 5 langkah: Release Document → Deployment Checklist → Rollback Plan → Checklist Capture → Status & Ekspor.)

## 3. Editor DDCL — Langkah 4: Checklist Capture (US2.4)

### Success / Populated State

```
+----------------------------------------------------------------------+
| <h1> DDCL BCAS PROD 202611 v2                        [lock] Anda      |
+----------------------------------------------------------------------+
| (1)Release Doc | (2)Checklist | (3)Rollback | (4)Capture* | (5)Status |
+----------------------------------------------------------------------+
| <h2> Checklist Capture (opsional)                                     |
+----------------------------------------------------------------------+
| Step                          | Catatan Eksekusi (opsional)           |
|--------------------------------|---------------------------------------|
| Backup database production      | [.............................]      |
| Deploy image baru ke K8s         | [.............................]      |
+----------------------------------------------------------------------+
|                                        [< Sebelumnya] [Selanjutnya >] |
+----------------------------------------------------------------------+
```
Accessibility: `<h2>` "Checklist Capture"; setiap baris catatan punya label field yang jelas ("Catatan eksekusi untuk <nama step>"), dan field boleh kosong tanpa validasi yang menghalangi "Selanjutnya" (AC2.4.1).

### Empty State

Sama dengan di atas, tapi field catatan semuanya kosong secara default — tidak ada pesan "data kosong" karena field ini memang opsional dan wajar kosong.

## 4. Editor DDCL — Langkah 5: Status & Ekspor — state Draft (baru: aksi "Tandai Sudah Dikirim" — US3.1)

```
+----------------------------------------------------------------------+
| <h1> DDCL BCAS PROD 202611 v2                        [lock] Anda      |
+----------------------------------------------------------------------+
| (1)Release Doc | (2)Checklist | (3)Rollback | (4)Capture | (5)Status* |
+----------------------------------------------------------------------+
| <h2> Status & Ekspor                                                  |
+----------------------------------------------------------------------+
| Status: Draft                                                         |
|                                                                        |
|                                       [Tandai Sudah Dikirim]           |
+----------------------------------------------------------------------+
```

### Saat "Tandai Sudah Dikirim" diklik

```
Dialog konfirmasi:
"Tandai DDCL ini sebagai sudah dikirim?"
Tanggal hari ini akan tercatat sebagai tanggal kirim, dan DDCL ini akan
menjadi read-only — tidak bisa diedit langsung lagi. Untuk perubahan
nanti, gunakan "Buat Revisi".
                                              [Batal]  [Ya, tandai dikirim]
```
Setelah konfirmasi: status berubah menjadi "Sudah Dikirim", tanggal kirim tercatat, DDCL menjadi read-only, dan tampilan berubah ke state yang ditunjukkan di Bagian 5 di bawah (AC3.1.1).

Accessibility: dialog sama persis pola dan atribut ARIA-nya dengan dialog "Buat Revisi" di Bagian 5 (lihat `interaction-spec.md` RevisionDialog — pola yang sama dipakai di sini dengan judul dan aksi berbeda).

Catatan Lock Badge di Editor: badge "[lock] Anda" pada dua mockup di atas menandakan DDCL ini sedang dikunci oleh pengguna yang sedang login sendiri (informasi, tidak memblokir). Jika seorang pengguna LAIN membuka DDCL yang sama saat sedang dikunci, Editor terbuka dalam mode baca saja dengan badge "[lock] Sedang diedit oleh <nama>" di posisi yang sama, dan semua kontrol input di setiap langkah wizard dinonaktifkan sampai lock dilepas (US6.1, AC6.1.1) — menjawab temuan review bahwa Lock Badge (sebelumnya hanya digambarkan di Dashboard) juga perlu muncul di Editor.

## 5. Editor DDCL — Langkah 5: Status & Ekspor — state Sudah Dikirim (baru: tombol Revisi — US3.2)

### Success / Populated State — DDCL berstatus "Sudah Dikirim" (read-only)

```
+----------------------------------------------------------------------+
| <h1> DDCL BCAS PROD 202611                           [read-only]      |
+----------------------------------------------------------------------+
| (1)Release Doc | (2)Checklist | (3)Rollback | (4)Capture | (5)Status* |
+----------------------------------------------------------------------+
| <h2> Status & Ekspor                                                  |
+----------------------------------------------------------------------+
| Status: Sudah Dikirim    Tgl Kirim: 2026-11-03                        |
|                                                                        |
| DDCL ini sudah dikirim dan tidak bisa diedit langsung.                |
|                                     [Buat Revisi (v2)]  [Unduh Excel] |
+----------------------------------------------------------------------+
```

### Saat "Buat Revisi" diklik

```
Dialog konfirmasi:
"Buat versi baru dari DDCL ini?"
Versi baru akan bernama "DDCL BCAS PROD 202611 v2", berstatus Draft,
dan bisa diedit. DDCL asli ini tidak berubah.
                                          [Batal]  [Ya, buat v2]
```
Setelah konfirmasi: sistem membuka Editor DDCL untuk "DDCL BCAS PROD 202611 v2" langsung di langkah 1 (Release Document), dengan data tersalin dari DDCL asal, siap diedit.

Accessibility: dialog konfirmasi menjebak fokus keyboard, bisa ditutup dengan Escape, fokus kembali ke tombol "Buat Revisi" saat dibatalkan (lihat `interaction-design-patterns.md` pola Modal).

## 6. Library Step & Object — Form Buat Step Baru (baru: Pasangan Rollback — US1.3)

```
Modal "Buat Step Baru":
+----------------------------------------------------------------------+
| <h2> Buat Step Baru                                              [x] |
+----------------------------------------------------------------------+
| Nama Step: [......................................]                  |
| Kategori Object: [Database v]                                        |
|                                                                        |
| Pasangan Rollback:                                                    |
|   ( ) Pilih dari Library yang sudah ada: [Cari step rollback...]     |
|   ( ) Buat step rollback baru:  [......................................] |
|   ( ) Belum ada, lengkapi nanti                                       |
+----------------------------------------------------------------------+
|                                   [Batal]  [Simpan ke Library & Tambahkan] |
+----------------------------------------------------------------------+
```

Accessibility: ketiga opsi radio button punya label yang jelas dibaca screen reader; field pencarian/isian yang relevan dengan opsi terpilih saja yang aktif (field pada opsi lain dinonaktifkan secara visual DAN `aria-disabled`).

## 7. Editor DDCL — Langkah 3: Rollback Plan (menampilkan step tanpa pasangan — AC1.3.2)

```
+----------------------------------------------------------------------+
| <h2> Rollback & Recovery Plan                                        |
+----------------------------------------------------------------------+
| Step Forward               | Rollback                                |
|------------------------------|------------------------------------|
| Backup database production   | Restore database dari backup         |
| Deploy image baru ke K8s      | [!] Belum ada pasangan rollback — [Lengkapi sekarang] |
+----------------------------------------------------------------------+
```
Accessibility: peringatan "[!]" disertai teks "Belum ada pasangan rollback", bukan ikon saja; tautan "Lengkapi sekarang" membuka modal yang sama seperti Bagian 4.

## 8. Modal Peringatan Ekspor Excel (baru — AC4.1.3–AC4.1.5, Q2)

### Kasus: data belum lengkap (blokir)

```
Dialog:
"DDCL belum lengkap"
Bagian berikut masih kosong dan harus diisi sebelum diekspor:
  - Release Objective (Release Document)
  - Belum ada step di Deployment Checklist
                                                      [Tutup]
```

### Kasus: jumlah step di luar kebiasaan (peringatan, tetap lanjut)

```
Dialog:
"Jumlah step di fase ini cukup banyak"
Fase "Deployment" punya 42 step, lebih banyak dari biasanya.
File tetap akan dihasilkan dengan benar.
                                          [Batal]  [Lanjutkan Unduh]
```

Accessibility: dialog blokir tidak punya tombol "Lanjutkan" (hanya "Tutup"), supaya jelas ini bukan pilihan, melainkan keharusan memperbaiki data dulu.
