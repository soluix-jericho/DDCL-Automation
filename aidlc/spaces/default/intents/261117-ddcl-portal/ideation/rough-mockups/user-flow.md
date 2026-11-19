# User Flow — Portal DDCL Otomatis

Format mengikuti `ux-guide.md` § User Flow Documentation Format.

## Flow 1: Membuat DDCL Baru (happy path)

```
Flow: Membuat DDCL Baru
Persona: Pembuat DDCL (pengguna utama portal, anggota tim operasional/infrastruktur)
Trigger: Pengguna perlu DDCL baru untuk rilis produksi berikutnya
Steps:
  1. Dashboard -> klik "+ Buat DDCL Baru" -> sistem membuka Editor DDCL (langkah 1: Release Document)
  2. Editor: Release Document -> isi Date, Start Date, Impacted System, Environment,
     Phase/Release #, Release Objective, Technical Change -> klik "Selanjutnya"
     -> sistem validasi field wajib, lanjut ke langkah 2
  3. Editor: Deployment Checklist -> klik "+ Tambah Step dari Library" -> pilih step
     yang sudah ada (atau "+ Buat Step Baru" jika belum ada yang cocok)
     -> sistem menampilkan kategori object/parameter sesuai jenis step -> pengguna
     isi nilai object/parameter -> ulangi untuk setiap step yang diperlukan (step
     yang sama boleh ditambahkan lebih dari sekali) -> klik "Selanjutnya"
  4. Editor: Rollback Plan -> sistem menampilkan rollback step yang sudah
     terpasang otomatis sebagai pasangan dari setiap step forward -> pengguna
     tinjau/lengkapi nilai object rollback -> klik "Selanjutnya"
  5. Editor: Checklist Capture -> pengguna isi bukti eksekusi (opsional, boleh
     dilewati) -> klik "Selanjutnya"
  6. Editor: Status & Ekspor -> pengguna tandai status "Sudah Dikirim" (manual)
     -> klik "Unduh Excel" -> sistem menghasilkan file mengikuti format
     `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` 1:1
  7. Sistem kembali ke Dashboard -> DDCL baru muncul di rekap dengan status dan
     tanggal terisi
Success outcome: DDCL tersimpan di portal, bisa diunduh sebagai file Excel sesuai
  format template, dan tercatat di Dashboard/Reporting dengan tanggal dibuat,
  tanggal dikirim, status, pembuat, dan object/step yang dipakai.
Error paths:
  - Field wajib di Release Document kosong -> pesan error di bawah field yang
    kosong, menyebutkan field mana -> pengguna tetap di langkah yang sama,
    input yang sudah diisi tidak hilang
  - Belum ada step ditambahkan saat lanjut dari langkah Checklist -> pesan
    "Tambahkan minimal satu step sebelum melanjutkan" -> pengguna tetap di
    langkah Checklist
  - Koneksi terputus saat menyimpan draft -> status autosave menunjukkan
    "Gagal menyimpan, mencoba lagi..." -> sistem mencoba ulang otomatis, data
    yang sudah diketik tidak hilang
```

## Flow 2: Membuat Step Baru dari Library (sub-flow, dipanggil dari Flow 1 langkah 3)

```
Flow: Membuat Step Baru
Persona: Pembuat DDCL
Trigger: Step yang dibutuhkan belum ada di Library
Steps:
  1. Editor DDCL (langkah Checklist) -> klik "+ Buat Step Baru" -> modal terbuka
  2. Modal -> isi nama step, pilih kategori object -> sistem menampilkan field
     object/parameter sesuai kategori -> isi rollback step pasangannya
     -> klik "Simpan ke Library & Tambahkan"
  3. Sistem menyimpan step baru ke Library (agar bisa dipakai ulang di DDCL lain)
     dan langsung menambahkannya ke DDCL yang sedang disusun -> modal tertutup,
     fokus kembali ke daftar step di Editor
Success outcome: Step baru tersedia di Library untuk dipakai ulang, dan langsung
  terpasang di DDCL yang sedang dibuat.
Error paths:
  - Nama step sama persis dengan step yang sudah ada di Library -> sistem
    menawarkan untuk memakai step yang sudah ada, bukan membuat duplikat
```

## Flow 3: Meninjau Rekap DDCL (Portal Reporting)

```
Flow: Meninjau Rekap DDCL
Persona: Pembuat DDCL / rekan tim
Trigger: Perlu melihat DDCL apa saja yang pernah dibuat dan statusnya
Steps:
  1. Dashboard -> gunakan filter (status, tanggal) dan/atau pencarian judul
     -> tabel rekap diperbarui sesuai filter
  2. Klik salah satu baris DDCL -> sistem membuka Editor DDCL dalam mode lihat
     (read-only jika statusnya sudah dikirim, dapat diedit jika masih draft)
Success outcome: Pengguna menemukan DDCL yang dicari beserta detail object/step
  yang dipakai, tanggal dibuat, dan tanggal dikirim.
Error paths:
  - Filter tidak menghasilkan data -> pesan "Tidak ada DDCL yang cocok dengan
    filter ini" dengan opsi reset filter
```

## Information Architecture

```
Dashboard / Portal Reporting (beranda)
├── Buat DDCL Baru -> Editor DDCL (wizard 5 langkah)
├── Klik baris DDCL -> Editor DDCL (mode lihat/edit)
└── Library Step & Object (navigasi utama)
    ├── Buat Step Baru
    └── Edit Step yang ada
```

Kedalaman navigasi maksimum 2 klik dari Dashboard ke detail DDCL manapun (sesuai `ux-guide.md`: setiap halaman terjangkau dalam 3 klik).
