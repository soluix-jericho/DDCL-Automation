# Wireframes — Portal DDCL Otomatis

Wireframe tingkat rendah (low-fidelity, ASCII) untuk tiga layar utama yang dikonfirmasi di `rough-mockups-questions.md` (Q1). Fokus desktop/laptop (Q5); aksesibilitas baseline WCAG 2.1 AA (Q6).

## Sumber

- `intent-statement.md` (Intent Capture) — masalah, target pengguna, dan batas scope versi pertama yang mendasari layar-layar di bawah.
- `scope-document.md` (Scope Definition) — daftar kapabilitas in-scope MVP yang diwireframe-kan (Release Document, Deployment Checklist, Rollback, status pengiriman manual, ekspor Excel, portal reporting).
- `intent-backlog.md` (Scope Definition) — proto-Unit IB1–IB8 yang memetakan ke tiga layar utama: Dashboard/Reporting (IB8), Editor DDCL (IB3, IB4, IB5, IB6, IB7), dan Library Step & Object (IB1, IB2).

## 1. Dashboard / Portal Reporting

Titik masuk utama portal: rekap semua DDCL yang pernah dibuat.

### Success / Populated State

```
+--------------------------------------------------------------------+
| [Logo] Portal DDCL        Dashboard | Library Step & Object  [User]|
+--------------------------------------------------------------------+
| <h1> Rekap DDCL                                  [+ Buat DDCL Baru]|
+--------------------------------------------------------------------+
| Filter: [Status v] [Tanggal v] [Cari...........]                   |
+--------------------------------------------------------------------+
| Judul DDCL      | Dibuat oleh | Tgl Dibuat | Tgl Dikirim | Status   |
|-----------------|-------------|------------|-------------|---------|
| DDCL BCAS PROD..| Budi        | 2026-11-01 | 2026-11-03  | Dikirim |
| DDCL XYZ PROD...| Sari        | 2026-11-10 | -           | Draft   |
+--------------------------------------------------------------------+
|                                    << 1 2 3 >>  Menampilkan 1-20/47 |
+--------------------------------------------------------------------+
```
Accessibility: `<h1>` "Rekap DDCL"; landmark `header`/`nav` (top bar), `main` (tabel + filter); entry keyboard: fokus pertama jatuh ke tombol "+ Buat DDCL Baru" setelah skip-link.

### Empty State

```
+--------------------------------------------------------------------+
| <h1> Rekap DDCL                                  [+ Buat DDCL Baru]|
+--------------------------------------------------------------------+
|              Belum ada DDCL yang dibuat.                            |
|              Mulai dengan membuat DDCL pertama Anda.                |
|                        [+ Buat DDCL Baru]                            |
+--------------------------------------------------------------------+
```

### Loading State

Skeleton baris tabel (5 baris placeholder pulsing) menggantikan tabel saat data sedang dimuat.

### Error State

```
|  [!] Gagal memuat data DDCL. Periksa koneksi Anda.  [Coba Lagi]     |
```

### Partial / Edge State

Nama DDCL sangat panjang dipotong dengan ellipsis + tooltip judul lengkap; status "Dikirim" tanpa tanggal dikirim ditampilkan sebagai "-" (bukan kosong/blank).

---

## 2. Editor DDCL (wizard bertahap, sesuai Q3)

Disusun sebagai tab/langkah terpisah: Release Document → Deployment Checklist → Rollback Plan → Checklist Capture → Status & Ekspor.

### Success / Populated State (langkah 2: Deployment Checklist)

```
+--------------------------------------------------------------------+
| <h1> DDCL BCAS PROD 202611                            [Simpan Draft]|
+--------------------------------------------------------------------+
| (1)Release Doc | (2)Checklist* | (3)Rollback | (4)Capture | (5)Status|
+--------------------------------------------------------------------+
| <h2> Deployment Checklist                        [+ Tambah Step]    |
+--------------------------------------------------------------------+
| # | Step                        | Kategori Object      |           |
|---|------------------------------|----------------------|-----------|
| 1 | Backup database production   | Database              | [Edit][x]|
| 2 | Deploy image baru ke K8s      | Docker/Kubernetes     | [Edit][x]|
+--------------------------------------------------------------------+
|   [+ Tambah Step dari Library]   [+ Buat Step Baru]                 |
+--------------------------------------------------------------------+
|                                        [< Sebelumnya] [Selanjutnya >]|
+--------------------------------------------------------------------+
```
Accessibility: `<h1>` judul DDCL, `<h2>` per langkah wizard; landmark `nav` untuk tab langkah (`role="tablist"`, Panah kiri/kanan untuk pindah tab, Tab untuk masuk ke panel); entry keyboard: fokus ke tombol "+ Tambah Step" setelah heading langkah.

### Empty State (langkah 2, belum ada step)

```
| Belum ada step ditambahkan. Pilih dari Library atau buat step baru. |
|   [+ Tambah Step dari Library]   [+ Buat Step Baru]                 |
```

### Loading State

Spinner inline di tombol "Simpan Draft" saat auto-save berjalan, dengan teks status "Menyimpan..." → "Tersimpan" (lihat `interaction-design-patterns.md` pola Autosave).

### Error State

```
| [!] Nama step tidak boleh kosong. Perbaiki sebelum melanjutkan.     |
```
Pesan error ditampilkan tepat di bawah field yang bermasalah, bukan hanya warna merah.

### Partial / Edge State

Step yang sama dipakai 2x dalam satu DDCL ditampilkan sebagai 2 baris terpisah (nomor urut berbeda, referensi ke step library yang sama); daftar step di Library yang sangat panjang menggunakan pencarian/filter, bukan scroll tak terbatas (sejalan dengan `interaction-design-patterns.md`: tabel/listing memakai pagination, bukan infinite scroll).

---

## 3. Library Step & Object

Kelola step dan kategori object/parameter reusable yang dipakai di Editor DDCL.

### Success / Populated State

```
+--------------------------------------------------------------------+
| <h1> Library Step & Object                        [+ Step Baru]     |
+--------------------------------------------------------------------+
| Cari step............    Kategori: [Semua v]                        |
+--------------------------------------------------------------------+
| Nama Step                  | Kategori Object      | Dipakai di     |
|------------------------------|----------------------|---------------|
| Backup database production   | Database              | 12 DDCL      |
| Deploy image baru ke K8s      | Docker/Kubernetes     | 8 DDCL       |
+--------------------------------------------------------------------+
```
Accessibility: `<h1>` "Library Step & Object"; landmark `main`; entry keyboard: fokus ke kolom pencarian setelah heading.

### Empty State

```
| Belum ada step di library. Step akan tersimpan otomatis saat Anda   |
| membuat step baru dari Editor DDCL, atau buat langsung di sini.     |
|                         [+ Step Baru]                                 |
```

### Loading / Error / Partial States

Mengikuti pola yang sama seperti Dashboard (skeleton loading, pesan error dengan tombol "Coba Lagi", teks terpotong + tooltip untuk nama step panjang).

---

## Catatan Desain

- Gaya visual: sederhana, elegan, dan user-friendly (Q4) — komponen standar, tanpa branding khusus, kontras warna memenuhi WCAG 2.1 AA (4.5:1 teks normal, 3:1 teks besar/komponen UI).
- Setiap layar punya satu primary action yang jelas (sesuai `ux-guide.md` heuristic #8: aesthetic & minimalist design).
- Semua elemen interaktif dapat dioperasikan penuh lewat keyboard (Tab, Enter, Escape untuk modal) sesuai baseline WCAG 2.1 AA yang dikonfirmasi.
