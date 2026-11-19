# Design System Mapping — Portal DDCL Otomatis

## Keputusan Pustaka (status)

Belum ada pustaka komponen UI spesifik yang dipilih untuk frontend TypeScript ini (`refined-mockups-questions.md` Q3). Arah yang disepakati: pustaka komponen UI open-source yang umum dan mudah dirawat (kategori "headless component + utility styling" atau setara), bukan membangun seluruh komponen dari nol. **Pemilihan pustaka persis (nama paket) adalah keputusan arsitektur dan akan dicatat sebagai ADR di tahap Domain Design**, bukan di tahap ini — sejalan dengan `feasibility-assessment.md` yang juga menunda pilihan framework spesifik ke tahap itu.

Mapping di bawah ini karena itu berbasis **kategori komponen**, bukan nama komponen pustaka tertentu, supaya tetap berlaku apapun pustaka yang akhirnya dipilih.

## Kategori Komponen yang Dibutuhkan

| Kategori | Dipakai di | Kebutuhan khusus |
|---|---|---|
| Table / data grid | Dashboard (US5.1, US5.2), Library (US1.1, US1.2) | Sortable belum wajib MVP; perlu dukungan baris dengan badge status/lock |
| Form fields (text, select, date) | Release Document (US2.1), form step Library (US1.1, US1.3) | Label selalu di atas field, bukan placeholder-only |
| Radio group | Rollback Pairing Field (US1.3) | Harus mendukung `radiogroup` ARIA native |
| Modal / Dialog | Buat Step Baru, Buat Revisi, Export Warning | Harus mendukung focus trap dan Escape-to-close bawaan |
| Wizard / Stepper | Editor DDCL 5 langkah (US2.1–US2.4, US3.1) | Harus mendukung navigasi maju/mundur tanpa kehilangan data |
| Badge / tag | Status DDCL, Lock Badge | Tidak bergantung warna saja — selalu disertai ikon + teks |
| Toast / inline alert | Validasi field, status autosave | Non-intrusive, auto-dismiss untuk sukses, persist untuk error |
| Search / filter input | Dashboard (US5.2), Library | Debounced, tidak query tiap keystroke |

## Design Tokens (usulan awal, bisa disesuaikan saat pustaka dipilih)

- **Skala spasi**: 4px, 8px, 16px, 24px, 32px, 48px (sesuai `wireframing-guide.md`).
- **Warna**: palet netral (abu-abu/putih) untuk latar, satu warna aksen untuk aksi utama, warna status standar (hijau=sukses/dikirim, kuning=peringatan/draft, merah=error) — semua dengan kontras minimum 4.5:1 teks normal, 3:1 teks besar/komponen UI (WCAG 2.1 AA).
- **Tipografi**: satu keluarga font sans-serif sistem, maksimum 3 ukuran heading (h1–h3) + 1 ukuran body, sesuai disiplin "sederhana, elegan, user-friendly" (Rough Mockups Q4).

## Konsistensi Lintas Layar

- Satu primary action per section (tombol solid berwarna aksen); aksi sekunder pakai tombol outline/teks.
- Posisi navigasi utama (top bar: Dashboard | Library Step & Object) konsisten di semua layar.
- Pola state kosong/loading/error konsisten di semua tabel (Dashboard, Library) — lihat `wireframes.md` Catatan Desain.
