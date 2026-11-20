# NFR Requirements — u1-walking-skeleton — Scalability

Sumber: `requirements.md` NFR1.

## Load Projections

| ID | Requirement |
|---|---|
| NFR1.4 | Skala yang didukung: < 20 pengguna aktif, ratusan DDCL per tahun (keseluruhan produk — skeleton sendiri hanya diuji dengan satu step dan satu DDCL). |

## Scaling Strategy

Tidak ada strategi scaling horizontal/vertikal untuk v1 — satu instance backend dan satu instance frontend di Docker Compose lokal cukup untuk skala yang disebutkan di atas (`team.md` ## Deployment). Tidak ada keputusan scaling yang perlu dibuat di skeleton ini.

## Concurrency

Skeleton ini tidak dirancang untuk concurrency ganda (lock, multi-pengguna nyata) — lihat Boundaries U1 di `unit-of-work.md`. Satu sesi dev-mode tetap berarti tidak ada dua aktor yang bisa bertabrakan di Unit ini.

## Assumptions & Open Questions

None.
