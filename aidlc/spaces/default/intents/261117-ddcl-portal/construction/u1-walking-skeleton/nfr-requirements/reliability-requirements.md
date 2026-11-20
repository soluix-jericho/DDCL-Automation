# NFR Requirements — u1-walking-skeleton — Reliability

Sumber: `requirements.md` NFR3, NFR4, `rules.md` BR1.4, BR1.5 (Functional Design).

## Availability

| ID | Requirement |
|---|---|
| NFR3.1 | Sistem HARUS bisa dijalankan sepenuhnya secara lokal via Docker Compose (backend, frontend, PostgreSQL), tanpa bergantung pada layanan eksternal. Tidak ada SLA/SLO uptime formal untuk v1 — ini alat internal lokal, bukan layanan yang diakses publik. |

## Fault Tolerance

| ID | Requirement |
|---|---|
| NFR3.2 | Saat database tidak bisa diakses, setiap endpoint skeleton mengembalikan error 500 generik ke klien dan mencatat detail di log server (BR1.5) — tidak ada retry otomatis atau fallback, sesuai jawaban Contract Design Q5 (retry otomatis hanya untuk GET idempotent, dan tidak ada GET yang menulis data di skeleton ini). |
| NFR3.3 | Saat file template Excel tidak ditemukan/tidak terbaca, ekspor gagal dengan pesan jelas (BR1.4); tidak ada file setengah jadi yang dihasilkan. |

## Backup/Recovery

Tidak ada strategi backup/recovery formal untuk v1 (di luar cakupan — keputusan hosting jangka panjang ditunda, `requirements.md` Out of Scope).

## Data Durability

| ID | Requirement |
|---|---|
| NFR4.1 | Data `Step`, `DdclDocument`, `ReleaseHeader`, `ChecklistItem` yang dibuat di skeleton ini disimpan permanen di PostgreSQL; tidak ada penghapusan otomatis. |

## Correctness — Export Fidelity

| ID | Requirement |
|---|---|
| NFR6.1 | Hasil ekspor Excel skeleton HARUS cocok 1:1 dengan tata letak `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (sheet, kolom, pengelompokan baris per fase) untuk kasus satu DDCL dengan satu step — dibuktikan secara manual pada checkpoint skeleton (Construction Verification Command: buka file hasil ekspor dan bandingkan dengan template). Test regresi otomatis sel-demi-sel adalah cakupan Build and Test, bukan NFR Requirements ini. |

## Graceful Degradation

Tidak berlaku pada skala skeleton ini — tidak ada komponen opsional yang bisa dinonaktifkan sebagian; setiap aksi (buat step, buat DDCL, ekspor) adalah all-or-nothing (BR1.5).

## Assumptions & Open Questions

None.
