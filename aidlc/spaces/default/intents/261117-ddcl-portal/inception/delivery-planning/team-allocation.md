# Delivery Planning — Team Allocation

Sumber: `aidlc-state.md` (Team Formation / stage 1.5 di-skip untuk scope `mvp`), `bolt-plan.md`, jawaban `delivery-planning-questions.md` Q4.

Stage Team Formation (1.5) tidak dijalankan untuk scope `mvp`: tidak ada tim manusia yang dibentuk untuk pekerjaan ini. Satu pembangun AI, `aidlc-developer-agent`, mengerjakan seluruh Bolt secara serial (Construction Execution: serial, Construction Iteration: unit-major — sudah tercatat di `aidlc-state.md`), didampingi `aidlc-architect-agent` untuk desain teknis per-Unit (Functional Design, NFR Design) sebelum Code Generation tiap Bolt.

## Penugasan Bolt

| Bolt | Unit | Pembangun |
|---|---|---|
| 1 | u1-walking-skeleton | aidlc-developer-agent |
| 2 | u2-step-library | aidlc-developer-agent |
| 3 | u4-user-accounts | aidlc-developer-agent |
| 4 | u3-ddcl-composition | aidlc-developer-agent |
| 5 | u6-excel-export-hardening | aidlc-developer-agent |
| 6 | u5-portal-reporting | aidlc-developer-agent |

Karena hanya ada satu pembangun yang mengerjakan satu Bolt pada satu waktu (jawaban Q4 — serial, bukan paralel), tidak ada peta koordinasi antar-tim (Program Board) yang relevan di sini: tidak ada tim kedua yang perlu disinkronkan.

## Assumptions & Open Questions

None.
