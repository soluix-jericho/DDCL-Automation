# NFR Design — u1-walking-skeleton — Scalability Design

Sumber: `nfr-requirements/scalability-requirements.md` (NFR1.4).

## Arsitektur Scaling

Satu instance backend Fastify dan satu instance frontend React di Docker Compose — tidak ada load balancer, tidak ada horizontal/vertical scaling untuk v1, sesuai skala yang didukung (<20 pengguna, NFR1.4).

## Data Partitioning

Tidak ada sharding/partisi data — satu database PostgreSQL tunggal cukup untuk skala data yang diproyeksikan (ratusan DDCL per tahun).

## Capacity Thresholds

Tidak ada ambang kapasitas formal untuk v1 — tidak ada mekanisme auto-scaling yang perlu dipicu.

## Assumptions & Open Questions

None.
