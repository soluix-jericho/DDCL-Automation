# Infrastructure Design — u1-walking-skeleton — CI/CD Pipeline

## Sources

- [Q4] Pipeline CI saja (tanpa CD) di setiap push/PR ke `main`; deployment v1 manual `docker compose up --build`; rollback lewat `git revert` lalu rebuild.
- [Q3] Secrets lewat `.env` yang tidak dikomit.
- [memory] `team.md` ## Testing Posture: coverage baris 80% dan eksekusi test di CI sebelum merge; ## Code Style: ESLint di CI, kegagalan memblokir PR.
- [memory] `team.md` ## Way of Working: trunk-based, integration branch `main`.

## Stages (CI)

**Platform:** GitHub Actions (repo ada di GitHub, `origin`), satu workflow di `.github/workflows/`. Dipicu pada setiap push dan pull request ke `main`, dengan job terpisah untuk backend dan frontend:

| Order | Stage | Command (indikatif) | Gate |
|---|---|---|---|
| 1 | Install | install dependencies (lockfile) per app | Gagal install → pipeline gagal |
| 2 | Lint | ESLint | Ada error → memblokir PR |
| 3 | Type-check | `tsc --noEmit` | Ada error tipe → memblokir PR |
| 4 | Migrate (backend) | `prisma migrate deploy` ke database uji | Migrasi gagal → pipeline gagal |
| 5 | Test | Vitest dengan coverage, dijalankan per app | Coverage baris < 80% **di masing-masing app** atau test gagal → memblokir PR |
| 6 | Build | build backend dan frontend | Gagal build → memblokir PR |

**Database uji:** job backend memakai service container PostgreSQL di GitHub Actions; kredensialnya dibuat di workflow (bukan dari `.env`).

**Template Excel di CI:** template asli tidak ada di repo, jadi test ekspor di CI memakai workbook fixture sintetis kecil yang dibuat di dalam test (struktur sheet/kolom yang sama dengan yang diuji), sehingga cakupan 80% tidak bergantung pada berkas asli. Kecocokan 1:1 dengan template asli (NFR6.1) diverifikasi manual pada checkpoint skeleton, sesuai NFR6.1.

**Memblokir PR:** pemblokiran membutuhkan pengaturan repo yang dilakukan manual oleh pemilik repo: branch protection pada `main` dengan status check backend dan frontend yang wajib lulus. Pengaturan ini bukan bagian dari kode dan dicatat sebagai langkah operasional satu kali.

Pemeriksaan format (Prettier) tetap mengikuti konfigurasi repo; tidak menjadi gate terpisah di skeleton.

## Deployment Strategy

- Tidak ada CD: "deployment" v1 adalah `docker compose up --build` manual oleh developer/operasional. Tidak ada blue-green/canary/rolling karena satu instance lokal.
- Promosi lingkungan: tidak ada (satu lingkungan lokal).
- Feature flags dan artifact registry: tidak ada untuk v1.

## Rollback

1. `git revert` komit bermasalah di `main`.
2. `docker compose up --build` ulang.
3. Data PostgreSQL tetap di named volume. Migrasi Prisma hanya maju (`prisma migrate deploy` saat start backend): komit yang menambah migrasi tidak bisa dibatalkan hanya dengan `git revert`. Pemulihannya adalah migrasi lanjutan yang membalik perubahan, atau restore dari cadangan manual `pg_dump` yang dibuat operator sebelum menjalankan versi dengan migrasi baru.

## Secrets in CI/CD

- Pipeline CI tidak butuh secrets nyata: test memakai database uji yang kredensialnya dibuat di job CI, tidak pernah dari `.env` produksi.
- `.env` tidak dikomit; `.env.example` dikomit sebagai template (NFR2.3).

## Assumptions & Open Questions

None.
