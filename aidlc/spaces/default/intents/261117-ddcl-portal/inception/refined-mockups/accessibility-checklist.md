# Accessibility Checklist — Portal DDCL Otomatis

Baseline: WCAG 2.1 AA (`refined-mockups-questions.md` Q4, mengikuti `accessibility-wcag.md`). Checklist ini diverifikasi ulang secara konkret (axe/keyboard/screen reader) di tahap Build and Test.

## Perceivable

- [ ] Kontras teks normal minimum 4.5:1, teks besar/komponen UI minimum 3:1 — berlaku untuk semua badge status, termasuk Lock Badge dan badge versi (v2, v3).
- [ ] Tidak ada informasi yang hanya disampaikan lewat warna — Lock Badge, status DDCL (Draft/Sudah Dikirim), dan severity Export Warning Dialog semuanya disertai ikon + teks.
- [ ] Semua ikon non-dekoratif (gembok, peringatan) punya teks alternatif atau label yang menyertainya secara visual dan untuk screen reader.

## Operable

- [ ] Semua elemen interaktif bisa dioperasikan penuh lewat keyboard: wizard Editor DDCL (Tab/Shift+Tab antar field, panah untuk pindah langkah), radio group Rollback Pairing Field (panah atas/bawah), semua modal (Tab terjebak di dalam, Escape menutup).
- [ ] Indikator fokus terlihat jelas (minimum 2px outline, kontras 3:1) di setiap elemen interaktif, termasuk tombol "Buat Revisi", "Lengkapi sekarang", dan opsi radio.
- [ ] Urutan tab mengikuti urutan visual logis di setiap langkah wizard dan setiap modal.
- [ ] Tidak ada keyboard trap di luar modal yang memang sengaja menjebak fokus sementara terbuka.
- [ ] Skip-to-content link tersedia sebagai elemen fokus pertama di setiap halaman (Dashboard, Editor DDCL, Library).

## Understandable

- [ ] Bahasa halaman dideklarasikan di HTML (`lang="id"`).
- [ ] Label field selalu di atas input (bukan placeholder-only) — Release Document, form step Library.
- [ ] Pesan error spesifik dan actionable: menyebutkan field yang bermasalah (AC2.1.2) dan bagian yang kosong sebelum ekspor (AC4.1.3), bukan pesan generik.
- [ ] Aksi yang mengubah konteks besar (membuat revisi, menghapus step) selalu lewat konfirmasi eksplisit (RevisionDialog, dialog hapus step), tidak otomatis saat fokus berpindah.
- [ ] Navigasi (top bar, wizard step) konsisten posisi dan labelnya di semua layar.

## Robust

- [ ] Markup semantik valid: heading h1–h3 berurutan tanpa lompat level (lihat `wireframes.md` dan `mockups.md` untuk struktur heading tiap layar).
- [ ] ARIA role dipakai sesuai komponen native setara ada: `dialog`/`alertdialog` untuk modal, `radiogroup` untuk Rollback Pairing Field, `status` untuk Lock Badge — bukan `div` dengan `role` yang dipaksakan jika elemen native tersedia.
- [ ] Konten berfungsi di browser modern yang relevan dengan pemakaian internal (tidak perlu dukungan browser lama — portal internal, bukan publik).

## Per-Layar (ringkasan dari `wireframes.md` dan `mockups.md`)

| Layar | Heading | Landmark | Entry keyboard |
|---|---|---|---|
| Dashboard / Portal Reporting | h1 "Rekap DDCL" | header/nav (top bar), main (tabel+filter) | fokus ke "+ Buat DDCL Baru" setelah skip-link |
| Editor DDCL (wizard) | h1 judul DDCL, h2 per langkah | nav (tablist langkah), main (panel langkah) | fokus ke heading langkah aktif, lalu kontrol pertama |
| Library Step & Object | h1 "Library Step & Object" | main | fokus ke kolom pencarian |
| Modal Buat Step Baru / Buat Revisi / Export Warning | h2 judul modal | dialog (focus-trapped) | fokus ke kontrol utama modal saat terbuka |
