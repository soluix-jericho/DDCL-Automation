# Units Generation — Dependency DAG

Topologi saja — urutan pengiriman ekonomis diputuskan di Delivery Planning, bukan di sini.

## Dependency Graph (prose)

- **u1-walking-skeleton** tidak bergantung pada Unit lain.
- **u2-step-library** bergantung pada u1-walking-skeleton (memperluas skema Step yang sudah ada dari skeleton).
- **u3-ddcl-composition** bergantung pada u1-walking-skeleton dan u2-step-library (rollback otomatis butuh data pasangan rollback yang lengkap dari Library).
- **u4-user-accounts** bergantung pada u1-walking-skeleton (menggantikan dev-mode stub sesi yang dibuat di sana).
- **u5-portal-reporting** bergantung pada u3-ddcl-composition (membaca data DDCL yang sudah punya seluruh field lengkap).
- **u6-excel-export-hardening** bergantung pada u1-walking-skeleton (memperluas ExcelExportService) dan u3-ddcl-composition (kasus tepi baris-per-fase hanya muncul setelah DDCL bisa berisi banyak step).

## Integration Points

| Antara | Mekanisme | Catatan |
|---|---|---|
| u1 ↔ u2 | Modul internal (panggilan fungsi dalam satu backend app) | u2 memperluas skema/entitas Step milik u1 |
| u2 ↔ u3 | Modul internal | u3 membaca detail step + pasangan rollback dari u2 saat menyusun checklist |
| u1 ↔ u3 | Modul internal | u3 memperluas entitas DdclDocument/ReleaseHeader/ChecklistItem milik u1 |
| u1/u2/u3 ↔ u4 | Modul internal (middleware sesi) | u4 menambahkan penegakan sesi di endpoint yang sudah ada di u1–u3 |
| u3 ↔ u5 | Modul internal (query read-only) | u5 tidak memodifikasi data DdclDocument |
| u1/u3 ↔ u6 | Modul internal | u6 memperluas ExcelExportService milik u1 dengan data DdclDocument yang lebih kaya dari u3 |
| Backend ↔ Frontend (tiap Unit) | API publik (REST) | Satu-satunya batas yang butuh kontrak API formal (lihat Contract Design); seluruh integrasi antar-Unit backend lewat modul internal, bukan jaringan (jawaban Q4) |

## Parallel Development Opportunities

Set Unit tanpa dependensi langsung satu sama lain (banyak urutan topologis valid di antara mereka):

- Setelah **u1-walking-skeleton** selesai: **u2-step-library** dan **u4-user-accounts** tidak saling bergantung — bisa dikerjakan paralel.
- **u3-ddcl-composition** menunggu **u2-step-library** selesai (butuh pasangan rollback lengkap), tapi tidak bergantung pada **u4-user-accounts** — keduanya bisa berjalan paralel dengan u3 setelah u2 selesai.
- **u5-portal-reporting** dan **u6-excel-export-hardening** sama-sama hanya bergantung pada u3 (dan u1 untuk u6) — begitu u3 selesai, keduanya bisa dikerjakan paralel.

## Walking Skeleton — Unit Pertama

**u1-walking-skeleton** adalah Unit pertama dalam urutan DAG yang terselesaikan (tidak bergantung pada Unit mana pun). Unit ini bisa berjalan secara mandiri dan ujung-ke-ujung sebelum Unit lain ada: satu step dibuat di StepLibrary, disusun ke satu DdclDocument minimal, lalu diekspor sebagai file Excel — seluruh tiga komponen domain (StepLibrary, DdclDocument, ExcelExportService) tersambung nyata lewat alur ini, diverifikasi dengan Construction Verification Command yang menunjukkan hasil ujung-ke-ujung sungguhan (file Excel yang bisa dibuka dan cocok tata letak template), bukan hanya dokumen desain. Unit-Unit berikutnya (U2–U6) memperluas cakupan fitur di atas pondasi yang sudah terbukti jalan ini.

## Dependency Edge Block

```yaml
units:
  - name: u1-walking-skeleton
    kind: service
    depends_on: []
  - name: u2-step-library
    kind: service
    depends_on: [u1-walking-skeleton]
  - name: u3-ddcl-composition
    kind: service
    depends_on: [u1-walking-skeleton, u2-step-library]
  - name: u4-user-accounts
    kind: service
    depends_on: [u1-walking-skeleton]
  - name: u5-portal-reporting
    kind: service
    depends_on: [u3-ddcl-composition]
  - name: u6-excel-export-hardening
    kind: service
    depends_on: [u1-walking-skeleton, u3-ddcl-composition]
```
