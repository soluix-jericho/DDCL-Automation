# NFR Design — u1-walking-skeleton — Performance Design

Sumber: `nfr-requirements/performance-requirements.md` (NFR1.1–1.4), jawaban `nfr-design-questions.md` Q2.

## Strategi

Tidak ada caching, connection pooling eksplisit di luar yang disediakan Prisma secara bawaan, atau async processing khusus — skala data skeleton (satu step, satu DDCL, satu pengguna) berada jauh di bawah titik yang membuat target <2 detik (NFR1.1–1.3) jadi perhatian nyata (jawaban Q2).

| NFR | Pendekatan |
|---|---|
| NFR1.1 (buat step) | Satu `INSERT` Prisma langsung; tidak ada optimisasi tambahan. |
| NFR1.2 (buat DDCL + checklist item) | Dua `INSERT` Prisma berurutan (DdclDocument+ReleaseHeader, lalu ChecklistItem); tidak ada transaksi multi-tabel khusus performa — konsistensi datanya dibahas di `reliability-design.md`. |
| NFR1.3 (ekspor Excel) | ExcelJS memuat template (file lokal, bukan jaringan), mengisi satu baris, menulis respons — operasi I/O file lokal yang jauh di bawah 2 detik untuk ukuran template yang ada. |
| NFR1.4 (skala <20 pengguna) | Tidak ada pekerjaan desain tambahan; connection pool bawaan Prisma cukup untuk <20 koneksi bersamaan. |

## Resource Pooling

Pool koneksi database memakai konfigurasi bawaan Prisma (tidak disetel khusus) — cukup untuk skala <20 pengguna (NFR1.4).

## Async Patterns

Seluruh tiga operasi (buat step, buat DDCL, ekspor) adalah request-response sinkron sederhana; tidak ada pemrosesan asinkron/antrian di skeleton ini.

## Assumptions & Open Questions

None.
