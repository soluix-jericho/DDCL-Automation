# Functional Design — u1-walking-skeleton — Entities

Sumber: `components.md` (Domain Design), jawaban `functional-design-questions.md` Q1, Q2.

Subset minimal dari `components.md` yang dipersist di skeleton ini — bukan skema baru, melainkan irisan dari entitas penuh yang sama yang U2/U3 perluas nanti.

```yaml
entities:
  - name: Step
    description: >
      Satu step reusable di Library. Skeleton hanya memakai jenis forward;
      pairedRollbackStepId ada di skema karena U2 memperluas entitas yang
      sama, tapi tidak diisi atau dipakai logika apa pun di Unit ini.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: name
        type: string
        required: true
      - name: category
        type: string
        required: true
      - name: kind
        type: enum
        required: true
        allowed_values: [forward, rollback]
        default: forward
      - name: pairedRollbackStepId
        type: string
        required: false
        references: Step
        note: Nullable di skeleton; diisi mulai U2 (US1.3).
    constraints:
      - "Tidak ada constraint keunikan nama di skeleton ini (deteksi duplikat — AC1.1.2 — milik U2)."
    relationships: []

  - name: DdclDocument
    description: >
      Satu DDCL. Skeleton hanya pernah membuat, tidak pernah mengubah status
      atau versi — field status/createdAt ada di skema karena U3 memperluas
      entitas yang sama.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: title
        type: string
        required: true
      - name: status
        type: enum
        required: true
        allowed_values: [Draft, Sudah Dikirim]
        default: Draft
        note: Skeleton selalu menulis "Draft"; transisi status adalah U3.
      - name: createdBy
        type: string
        required: true
        note: >
          Nilai stub tetap "dev-user" (jawaban Q2) — bukan foreign key ke
          tabel User, karena UserAccount (U4) belum dibangun. U4 melakukan
          retrofit nilai ini menjadi User.id sungguhan.
      - name: createdAt
        type: datetime
        required: true
    constraints: []
    relationships: []

  - name: ReleaseHeader
    description: Header Release Document milik satu DdclDocument.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: ddclId
        type: string
        required: true
        references: DdclDocument
      - name: date
        type: date
        required: false
        note: Tidak ada validasi field wajib di skeleton (AC2.1.2 milik U3).
      - name: startDate
        type: date
        required: false
      - name: impactedSystem
        type: string
        required: false
      - name: environment
        type: string
        required: false
      - name: phaseRelease
        type: string
        required: false
      - name: releaseObjective
        type: string
        required: false
      - name: technicalChange
        type: string
        required: false
    constraints: []
    relationships:
      - entity: DdclDocument
        cardinality: "1:1"
        direction: "ReleaseHeader -> DdclDocument"

  - name: ChecklistItem
    description: >
      Satu baris checklist. Skeleton hanya pernah menambahkan satu baris per
      DDCL (order selalu 1) — reorder dan duplikasi baris (US2.2 penuh) milik
      U3.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: ddclId
        type: string
        required: true
        references: DdclDocument
      - name: stepId
        type: string
        required: true
        references: Step
      - name: order
        type: integer
        required: true
        default: 1
      - name: parameterValues
        type: object
        required: false
    constraints:
      - "Skeleton tidak mencegah penambahan lebih dari satu baris, tapi functional-spec.md hanya merancang alur satu baris; perilaku dengan baris >1 tidak dirancang di sini (di luar cakupan, bukan dilarang)."
    relationships:
      - entity: DdclDocument
        cardinality: "N:1"
        direction: "ChecklistItem -> DdclDocument"
      - entity: Step
        cardinality: "N:1"
        direction: "ChecklistItem -> Step"
```

## Ringkasan

Empat entitas dipersist: `Step` (StepLibrary), `DdclDocument` + `ReleaseHeader` + `ChecklistItem` (DdclDocument). Tidak ada entitas `User` nyata — `DdclDocument.createdBy` memakai nilai string stub, bukan referensi. `RollbackItem` dan `CaptureNote` dari `components.md` tidak dipersist sama sekali di skeleton ini (di luar Boundaries U1).

## Assumptions & Open Questions

None.
