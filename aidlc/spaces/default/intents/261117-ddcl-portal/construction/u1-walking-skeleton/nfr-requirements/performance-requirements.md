# NFR Requirements — u1-walking-skeleton — Performance

Sumber: `requirements.md` NFR1, `functional-spec.md` (alur 11-langkah skeleton — tiga aksi di bawah ini adalah langkah 1–3, 4–7, dan 8–10 dari alur itu), jawaban `nfr-requirements-questions.md` Q7.

## Target

| ID | Target | Berlaku untuk | Kondisi |
|---|---|---|---|
| NFR1.1 | Selesai dalam < 2 detik | Buat step (`POST /api/v1/steps`) | Skala < 20 pengguna aktif, jaringan lokal normal |
| NFR1.2 | Selesai dalam < 2 detik | Buat DDCL + tambah satu checklist item (`POST /api/v1/ddcls`, `POST /api/v1/ddcls/{id}/checklist-items`) | Sama seperti di atas |
| NFR1.3 | Selesai dalam < 2 detik | Unduh Excel (`GET /api/v1/ddcls/{id}/export`) | Satu DDCL dengan satu step (skala data skeleton) |

Ketiga target memakai ambang yang sama (jawaban Q7) — skala data skeleton (satu step, satu DDCL) jauh di bawah titik yang membuat 2 detik menjadi perhatian nyata; tidak ada benchmark beban yang relevan pada skala ini.

## Resource Constraints

- Backend (Fastify) dan frontend (React + Vite) berjalan sebagai dua proses Node.js terpisah di Docker Compose yang sama (`team.md` ## Deployment) — tidak ada batas CPU/memori eksplisit untuk v1 lokal.

## Assumptions & Open Questions

None.
