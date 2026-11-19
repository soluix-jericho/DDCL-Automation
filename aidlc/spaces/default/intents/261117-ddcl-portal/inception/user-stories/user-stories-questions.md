# User Stories — Story Plan & Questions

## Sources

- [memory] `aidlc/spaces/default/intents/261117-ddcl-portal/inception/requirements-analysis/requirements.md`
- [memory] `aidlc/spaces/default/intents/261117-ddcl-portal/ideation/intent-capture/intent-statement.md` (Target Customer)

## Pendekatan Persona

Usulan: satu persona utama untuk MVP — **Budi, Pembuat DDCL** (anggota tim operasional/infrastruktur yang membuat dokumen rilis produksi secara rutin). Requirements FR9 tetap mencatat portal mendukung banyak akun, tapi untuk v1 praktis hanya persona ini yang memakainya (Requirements Analysis Q4).

## Format Story

Standar INVEST: "Sebagai [persona], saya ingin [aksi], supaya [manfaat]." dengan 3-6 kriteria penerimaan format Given/When/Then per story, ID stabil `US{group}.{seq}` dan `AC{group}.{seq}.{n}`.

## Prioritas

MoSCoW per requirement: setiap FR yang ditandai HARUS di `requirements.md` menjadi Must Have; FR9 (multi-akun) dan skenario lock (FR10) tetap Must Have karena bagian dari requirement MVP yang sudah disepakati, meski dipakai ringan di v1.

## Pendekatan Pemecahan

Usulan: per alur kerja (workflow), mengikuti urutan dependency-first dari `intent-backlog.md`: Library Step & Object → Penyusunan DDCL (header, checklist, rollback, capture) → Status & Versi → Ekspor Excel → Portal Reporting.

## Q1. Apakah pendekatan persona tunggal (Budi, Pembuat DDCL) di atas sudah cukup untuk MVP?

- A. Ya, cukup satu persona untuk MVP
- B. Perlu persona tambahan (sebutkan, misalnya "rekan tim yang hanya melihat rekap")
- X. Other (please specify)

[Answer]: A

## Q2. Apakah pendekatan pemecahan story per alur kerja (workflow) di atas sudah sesuai?

- A. Ya, pecah per alur kerja sesuai urutan dependency-first
- B. Lebih suka dipecah dengan cara lain (sebutkan, misalnya per domain/per persona)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Persona tunggal untuk MVP: Budi, Pembuat DDCL (Q1).
- Story dipecah per alur kerja, urutan dependency-first: Library Step & Object → Penyusunan DDCL → Status & Versi → Ekspor Excel → Portal Reporting → Multi-Pengguna & Konkurensi (Q2).
- 13 user story dihasilkan (12 Must Have, 1 Should Have) mencakup seluruh FR/NFR di `requirements.md`, dengan traceability lengkap di `traceability.json`.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
