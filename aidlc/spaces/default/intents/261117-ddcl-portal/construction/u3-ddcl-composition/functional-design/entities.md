# Functional Design — u3-ddcl-composition — Entities

## Sources

- [memory] `components.md` (komponen DdclDocument, ReleaseHeader, ChecklistItem, RollbackItem, CaptureNote), U1 `entities.md` dan skema Prisma saat ini (`DdclDocument`, `ReleaseHeader`, `ChecklistItem`), U2 `entities.md` (`stepSnapshot`) dan `rules.md` BR2.8, BR2.14.
- [memory] `requirements.md` FR1, FR3–FR6, FR10, FR10.1; `stories.md` US2.1–US2.4, US3.1, US3.2, US6.1.
- [Q1–Q13] jawaban `functional-design-questions.md`; Q6 dan Q12 menetapkan Checklist Capture sebagai tabel kosong mengikuti template (kolom Step, Actual Time, Capture Before, Capture After) tanpa data tersimpan.

Perubahan terhadap kode saat ini: `DdclDocument` mendapat siklus status empat nilai, tiga tanggal status, catatan rollback, hubungan versi (`familyId`, `versionNumber`, `parentDdclId`) dan atribut lock; `ReleaseHeader` tidak berubah bentuk (hanya aturan wajib diisi, di `rules.md`); `ChecklistItem` mendapat `source`; ada entitas baru `RollbackItem`. `CaptureNote` tidak punya tabel di v1.

```yaml
entities:
  - name: DdclDocument
    description: >
      Satu DDCL beserta siklus statusnya. Menjadi akar header, checklist,
      rollback, dan tempat atribut versi serta lock. Memperluas
      DdclDocument milik U1/U4 tanpa mengganti kolom yang ada.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: title
        type: string
        required: true
        note: Nama DDCL, 1–200 karakter setelah spasi ujung dibuang. Versi baru bernama "<judul DDCL asli> v<N>" (BR3.14).
      - name: status
        type: enum
        required: true
        allowed_values: [Draft, SudahDikirim, Tereksekusi, DiRollback]
        default: Draft
        note: Ditampilkan sebagai "Draft", "Sudah Dikirim", "Tereksekusi", "Di-rollback". Dua nilai terakhir baru (keputusan Q10, Q13); skema saat ini hanya punya dua nilai pertama.
      - name: sentAt
        type: datetime
        required: false
        note: Diisi saat status menjadi Sudah Dikirim; bawaan jam database, boleh diubah pengguna (Q7).
      - name: executedAt
        type: datetime
        required: false
        note: Diisi saat status menjadi Tereksekusi; bawaan jam database, boleh diubah.
      - name: rolledBackAt
        type: datetime
        required: false
        note: Diisi saat status menjadi Di-rollback; bawaan jam database, boleh diubah.
      - name: rollbackNote
        type: string
        required: false
        note: Catatan singkat saat menandai rollback, maksimal 500 karakter.
      - name: familyId
        type: string
        required: true
        references: DdclDocument
        note: id DDCL asli (versi 1) dari keluarga versi ini; untuk versi 1 sama dengan id sendiri. Dasar pengelompokan satu baris per DDCL asli (Q2).
      - name: versionNumber
        type: integer
        required: true
        default: 1
        note: 1 untuk DDCL asli, 2 untuk "v2", dan seterusnya.
      - name: parentDdclId
        type: string
        required: false
        references: DdclDocument
        note: DDCL tempat revisi ini dibuat; null untuk versi 1.
      - name: lockedByUserId
        type: string
        required: false
        references: User
        note: Pemegang lock edit saat ini; null bila tidak ada.
      - name: lockedAt
        type: datetime
        required: false
        note: Waktu aktivitas terakhir pemegang lock (diperbarui tiap simpan atau perpanjangan), dibaca dengan jam database. Lock dianggap lepas bila lebih tua dari 15 menit (BR3.9).
      - name: createdByUserId
        type: string
        required: false
        references: User
        note: Sudah ada (U4); nullable di database, ditegakkan kode. Pembuat revisi adalah pengguna yang menekan tombol revisi.
      - name: createdAt
        type: datetime
        required: true
    constraints:
      - "Unik pada (familyId, versionNumber): dua revisi serentak dari DDCL yang sama tidak bisa mendapat nomor versi sama (BR3.14)."
      - "parentDdclId tidak boleh menunjuk dirinya sendiri; penghapusan DDCL yang masih punya anak ditolak oleh foreign key (Restrict)."
      - "sentAt <= executedAt <= rolledBackAt bila terisi (BR3.7)."
      - "lockedByUserId dan lockedAt keduanya terisi atau keduanya kosong."
      - "status Draft hanya boleh punya sentAt, executedAt, rolledBackAt kosong; setiap status lanjutan mewajibkan tanggal status yang sesuai terisi."
    relationships:
      - "memiliki satu ReleaseHeader"
      - "memiliki banyak ChecklistItem dan banyak RollbackItem"
      - "mereferensi dirinya lewat parentDdclId dan familyId"

  - name: ReleaseHeader
    description: >
      Header Release Document (FR1). Bentuk tabel sudah ada di U1; U3 hanya
      menambah aturan field wajib dan tidak mengubah kolom.
    attributes:
      - name: ddclId
        type: string
        required: true
        unique: true
        references: DdclDocument
      - name: date
        type: date
        required: true
      - name: startDate
        type: date
        required: true
      - name: impactedSystem
        type: string
        required: true
      - name: environment
        type: string
        required: true
      - name: phaseRelease
        type: string
        required: true
      - name: releaseObjective
        type: string
        required: true
      - name: technicalChange
        type: string
        required: false
        note: Satu-satunya field header yang opsional (Q5).
    constraints:
      - "Kolom di database tetap nullable; kewajiban diisi ditegakkan oleh kode saat membuat dan mengubah (BR3.1), sehingga tidak ada migrasi untuk ini."
    relationships:
      - "milik satu DdclDocument"

  - name: ChecklistItem
    description: >
      Satu baris step di Deployment Checklist. Tabel sudah ada (U1, diperluas
      U2 dengan stepSnapshot). U3 menambah asal baris.
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
        required: false
        references: Step
        note: Sudah ada; menjadi null bila step dihapus dari Library (U2 BR2.8).
      - name: order
        type: integer
        required: true
        note: Posisi 1-based, selalu rapat berurutan per DDCL (BR3.3).
      - name: source
        type: enum
        required: true
        allowed_values: [step, bundle]
        default: step
        note: Baru. step bila dipasang sendirian, bundle bila berasal dari memasang bundle. Menentukan apakah penanda "Belum ada rollback" berlaku (BR3.6).
      - name: parameterValues
        type: json
        required: false
        note: Sudah ada. Objek nama variabel ke nilai teks; hanya nama variabel yang ada di stepSnapshot (BR3.4).
      - name: stepSnapshot
        type: json
        required: true
        note: Sudah ada (U2). Tidak pernah ditulis ulang oleh U3 setelah item dibuat, kecuali disalin apa adanya saat duplikasi dan revisi.
    constraints:
      - "Unik pada (ddclId, order) tidak ditegakkan di database; penataan ulang dilakukan di dalam satu transaksi."
    relationships:
      - "milik satu DdclDocument"
      - "boleh memiliki satu RollbackItem pasangan (lewat RollbackItem.checklistItemId)"

  - name: RollbackItem
    description: >
      Satu baris di bagian Rollback & Recovery Plan. Urutannya diatur
      sendiri, terpisah dari checklist (Q4 jawaban C). Berasal dari pasangan
      rollback sebuah step atau dari rangkaian rollback sebuah bundle.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: ddclId
        type: string
        required: true
        references: DdclDocument
      - name: checklistItemId
        type: string
        required: false
        references: ChecklistItem
        note: Terisi hanya untuk rollback pasangan sebuah step yang dipasang sendirian; hilang bersama item itu (cascade). Null untuk rollback dari bundle.
      - name: order
        type: integer
        required: true
        note: Posisi 1-based, rapat berurutan per DDCL, terpisah dari order checklist.
      - name: source
        type: enum
        required: true
        allowed_values: [step, bundle]
      - name: parameterValues
        type: json
        required: false
        note: Nilai variabel untuk step rollback ini, aturannya sama dengan ChecklistItem.
      - name: stepSnapshot
        type: json
        required: true
        note: Salinan isi step rollback saat dibuat (BR2.8); diambil dari salinan pasangan rollback di stepSnapshot item, atau dari anggota rollback bundle.
    constraints:
      - "Rollback item tidak punya stepId hidup: ia hanya merujuk snapshot, sehingga menghapus step Library tidak menyentuhnya."
    relationships:
      - "milik satu DdclDocument"
      - "boleh menunjuk satu ChecklistItem pasangan"

  - name: CaptureNote
    description: >
      Bagian Checklist Capture di v1 hanya berupa tabel kosong dengan kolom
      mengikuti template (Step, Actual Time, Capture Before, Capture After),
      tidak terhubung ke step, tidak divalidasi, dan tidak menyimpan data
      (Q6, Q12). Tidak ada tabel database di v1; entitas ini sengaja
      ditunda sampai ada kebutuhan mengisi capture.
    attributes: []
    constraints:
      - "Ekspor Excel (U6) mencetak baris judul kolom dan baris kosong sesuai template; layar menampilkan tabel kosong yang sama."
    relationships: []
```

## Ringkasan

Empat entitas didefinisikan atau diperluas: `DdclDocument` (status empat nilai, tanggal status, versi, lock), `ReleaseHeader` (hanya aturan wajib), `ChecklistItem` (asal baris), dan `RollbackItem` (baru, urutan sendiri). `CaptureNote` tidak punya data di v1. Diagram ER ada di `functional-spec.md`.

## Assumptions & Open Questions

None.
