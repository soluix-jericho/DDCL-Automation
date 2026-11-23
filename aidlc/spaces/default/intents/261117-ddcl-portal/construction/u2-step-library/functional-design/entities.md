# Functional Design — u2-step-library — Entities

Sumber: `components.md` (Domain Design, komponen StepLibrary), U1 `entities.md` (skema `Step` yang diperluas, bukan diganti), `requirements.md` (FR2, FR2.1–FR2.4, FR4), jawaban `functional-design-questions.md` Q1–Q11.

Perubahan terhadap U1: `Step` mendapat `createdAt`/`updatedAt` dan tiga entitas anak (kolom langkah, baris langkah, lampiran); ada entitas baru `StepBundle` beserta dua tabel keanggotaannya; `ChecklistItem` (milik DdclDocument) mendapat snapshot step karena penghapusan step harus tidak menyentuh DDCL lama (FR2.4).

```yaml
entities:
  - name: Step
    description: >
      Satu step reusable di Library, forward atau rollback. Memperluas Step
      dari U1: isi step kini berupa kolom-kolom langkah bernomor dan
      lampiran. Kategori hanya label pengelompokan; isian yang diminta saat
      step dipasang ke DDCL berasal dari variabel di teks langkah (Q10).
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: name
        type: string
        required: true
        note: Judul step, mis. "Update Deployment CES".
      - name: category
        type: enum
        required: true
        allowed_values: [Database, Bastion, RabbitMQ, Keycloak]
        note: Daftar tetap (Q4); menambah kategori butuh perubahan konfigurasi/kode, bukan aksi pengguna di U2.
      - name: kind
        type: enum
        required: true
        allowed_values: [forward, rollback]
        default: forward
      - name: pairedRollbackStepId
        type: string
        required: false
        references: Step
        note: Hanya untuk kind forward; menunjuk Step ber-kind rollback. Null berarti belum ada pasangan.
      - name: createdAt
        type: datetime
        required: true
      - name: updatedAt
        type: datetime
        required: true
    constraints:
      - "Kombinasi name (tanpa membedakan huruf besar/kecil, spasi ujung dibuang), category, dan kind unik."
      - "pairedRollbackStepId hanya boleh terisi jika kind = forward, dan targetnya harus Step dengan kind = rollback."
      - "Sebuah Step punya paling sedikit satu StepLine yang tidak kosong."
    relationships:
      - target: StepColumn
        cardinality: "1..*"
        direction: Step -> StepColumn
      - target: StepAttachment
        cardinality: "0..*"
        direction: Step -> StepAttachment
      - target: Step
        cardinality: "0..1"
        direction: "Step(forward) -> Step(rollback) via pairedRollbackStepId"

  - name: StepColumn
    description: >
      Satu kolom langkah milik sebuah Step. Step baru dimulai dengan 3
      kolom; pengguna bisa menambah kolom lewat tombol (Q1, Q9). Tiap kolom
      berisi daftar langkah bernomor sendiri.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: stepId
        type: string
        required: true
        references: Step
      - name: position
        type: integer
        required: true
        min: 1
        note: Urutan kolom dalam step, berurutan tanpa celah.
      - name: label
        type: string
        required: false
        note: Judul kolom (opsional).
    constraints:
      - "Kombinasi (stepId, position) unik."
      - "Sebuah Step punya paling sedikit satu kolom."
    relationships:
      - target: StepLine
        cardinality: "0..*"
        direction: StepColumn -> StepLine

  - name: StepLine
    description: Satu langkah bernomor di dalam sebuah kolom. Nomor tidak disimpan; dibuat dari posisi.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: columnId
        type: string
        required: true
        references: StepColumn
      - name: position
        type: integer
        required: true
        min: 1
      - name: text
        type: string
        required: true
        note: Teks langkah; boleh memuat variabel {nama} (lihat BR2.4).
    constraints:
      - "Kombinasi (columnId, position) unik."
    relationships: []

  - name: StepAttachment
    description: >
      Lampiran teks milik sebuah Step: nama file dengan ekstensi bebas
      (.yaml, .sql, .py, dan sejenisnya) beserta isinya (Q3). Isinya ikut ke
      DDCL saat step dipasang dan bisa diubah per DDCL (U3).
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: stepId
        type: string
        required: true
        references: Step
      - name: filename
        type: string
        required: true
        note: Tanpa pemisah path; unik dalam satu Step.
      - name: content
        type: text
        required: true
        note: Teks UTF-8. Batas ukuran ditetapkan di NFR Design, harus ada.
      - name: position
        type: integer
        required: true
        min: 1
    constraints:
      - "Kombinasi (stepId, filename) unik."
    relationships: []

  - name: StepBundle
    description: >
      Kelompok step di Library (Q11). Berisi beberapa step forward berurutan
      (mis. buka database sampai jalankan query = 3 step) yang terhubung ke
      rangkaian step rollback miliknya sendiri; jumlah step rollback boleh
      berbeda dari jumlah step forward (mis. 2 rollback untuk 3 forward).
      Pasangan rollback per step (Step.pairedRollbackStepId) tetap ada.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: name
        type: string
        required: true
      - name: category
        type: enum
        required: false
        allowed_values: [Database, Bastion, RabbitMQ, Keycloak]
        note: Opsional; hanya untuk pengelompokan dan filter tampilan.
      - name: createdAt
        type: datetime
        required: true
      - name: updatedAt
        type: datetime
        required: true
    constraints:
      - "name unik (tanpa membedakan huruf besar/kecil, spasi ujung dibuang)."
      - "Punya paling sedikit satu anggota forward; bundle yang kehilangan anggota forward terakhirnya (karena step dihapus) ikut dihapus (BR2.7). Rangkaian rollback boleh kosong."
    relationships:
      - target: BundleForwardMember
        cardinality: "1..*"
        direction: StepBundle -> BundleForwardMember
      - target: BundleRollbackMember
        cardinality: "0..*"
        direction: StepBundle -> BundleRollbackMember

  - name: BundleForwardMember
    description: Keanggotaan terurut sebuah Step forward dalam sebuah StepBundle.
    attributes:
      - name: bundleId
        type: string
        required: true
        references: StepBundle
      - name: stepId
        type: string
        required: true
        references: Step
        note: Harus Step ber-kind forward.
      - name: position
        type: integer
        required: true
        min: 1
    constraints:
      - "Kombinasi (bundleId, stepId) unik; kombinasi (bundleId, position) unik."
    relationships: []

  - name: BundleRollbackMember
    description: Keanggotaan terurut sebuah Step rollback dalam rangkaian rollback sebuah StepBundle.
    attributes:
      - name: bundleId
        type: string
        required: true
        references: StepBundle
      - name: stepId
        type: string
        required: true
        references: Step
        note: Harus Step ber-kind rollback.
      - name: position
        type: integer
        required: true
        min: 1
    constraints:
      - "Kombinasi (bundleId, stepId) unik; kombinasi (bundleId, position) unik."
    relationships: []

  - name: ChecklistItem
    description: >
      Entitas milik DdclDocument (U1), dirinci di sini hanya perubahan yang
      dibutuhkan U2: menyimpan snapshot step saat dibuat supaya menghapus
      atau mengubah Step di Library tidak menyentuh DDCL yang sudah memakainya
      (FR2.4, AC1.2.2, AC1.3.3).
    attributes:
      - name: stepId
        type: string
        required: false
        references: Step
        note: Berubah dari wajib menjadi opsional; menjadi null ketika Step dihapus dari Library. Tidak lagi menahan penghapusan.
      - name: stepSnapshot
        type: json
        required: true
        note: >
          Salinan isi Step saat item dibuat: name, category, kind, kolom dan
          langkahnya, lampiran, serta salinan pasangan rollback bila ada.
          Tidak pernah ditulis ulang setelah dibuat oleh aksi di Library.
      - name: perDdclValues
        type: json
        required: false
        note: Nilai variabel dan perubahan lampiran per DDCL; dimiliki dan dirinci U3, ditulis terpisah dari stepSnapshot.
    constraints:
      - "Penghapusan atau pengeditan Step tidak mengubah stepSnapshot item mana pun."
      - "Item yang dibuat sebelum U2 diberi stepSnapshot saat migrasi dari data Step yang ada."
    relationships: []
```

## Ringkasan

Delapan entitas didefinisikan atau diubah. `Step` diperluas (kolom, baris, lampiran) tanpa mengganti skema U1; `StepBundle` dengan dua tabel keanggotaan menambah kelompok step beserta rollback-nya; `ChecklistItem` mendapat snapshot supaya Library bebas menghapus step. Isian yang diminta saat step dipasang ke DDCL tidak disimpan sebagai skema per kategori: ia diturunkan dari variabel `{nama}` di teks langkah (BR2.4).
