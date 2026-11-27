# Functional Design — u4-user-accounts — Entities

Sumber: `unit-of-work.md` (U4), `components.md` (Domain Design, komponen UserAccount), `requirements.md` (FR9, NFR2), `stories.md` (US6.2/AC6.2.1), `contract-summary.md` (Contract 1), U1 `entities.md` (`DdclDocument.createdBy` stub), jawaban `functional-design-questions.md` Q1–Q14 (Q12–Q14 dari putaran revisi setelah NFR Requirements).

Perubahan terhadap Unit sebelumnya: entitas `User` penuh menggantikan stub `dev-user`; ada tiga entitas baru (`Session`, `LoginThrottle`, `AuditEvent`); `DdclDocument.createdBy` (string stub) diganti `createdByUserId` yang merujuk `User.id`.

**Deviasi scope yang diputuskan manusia (Q1, Q9):** `requirements.md` menaruh role di Out of Scope v1. Atas permintaan pengguna, tiga role sederhana (admin, editor, viewer) masuk U4, tanpa kepemilikan per-DDCL. Kepemilikan DDCL per pengguna tetap Out of Scope.

```yaml
entities:
  - name: User
    description: >
      Satu akun yang bisa login. Semua akun milik satu perusahaan; tidak ada
      pemisahan tenant. Akun tidak pernah dihapus, hanya dinonaktifkan,
      supaya DDCL lama tetap tahu pembuatnya (Q5).
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: name
        type: string
        required: true
        min: 1
        max: 100
        note: Nama tampilan; spasi ujung dibuang.
      - name: email
        type: string
        required: true
        unique: true
        max: 254
        note: Disimpan dalam huruf kecil dengan spasi ujung dibuang; keunikan dicek pada bentuk itu. Email akun nonaktif tetap dicadangkan.
      - name: passwordHash
        type: string
        required: true
        note: Hasil scrypt dengan garam acak per akun (parameter dan garam ikut tersimpan di nilai ini). Tidak pernah dikirim ke klien.
      - name: role
        type: enum
        required: true
        allowed_values: [admin, editor, viewer]
        note: Dibaca dari database di setiap permintaan, sehingga perubahan role berlaku di permintaan berikutnya.
      - name: status
        type: enum
        required: true
        allowed_values: [active, inactive]
        default: active
      - name: createdAt
        type: datetime
        required: true
      - name: updatedAt
        type: datetime
        required: true
      - name: lastLoginAt
        type: datetime
        required: false
    constraints:
      - Sistem selalu punya sedikitnya satu User berstatus active dengan role admin (dijaga oleh BR4.13, BR4.14).
      - Baris User tidak pernah dihapus.
    relationships:
      - target: Session
        cardinality: "0..*"
        direction: User memiliki nol atau banyak Session
      - target: DdclDocument
        cardinality: "0..*"
        direction: User membuat nol atau banyak DdclDocument (lewat createdByUserId)

  - name: Session
    description: >
      Satu sesi login. Token acak hanya dikirim ke klien sekali (cookie
      dan badan respons login); database hanya menyimpan hash-nya sehingga
      sesi bisa dicabut dan kebocoran database tidak membocorkan sesi aktif.
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: userId
        type: string
        required: true
        references: User
      - name: tokenHash
        type: string
        required: true
        unique: true
        note: SHA-256 dari token acak 256 bit. Pencarian sesi selalu lewat hash ini.
      - name: createdAt
        type: datetime
        required: true
        note: Waktu login; dasar batas mutlak 7 hari.
      - name: lastSeenAt
        type: datetime
        required: true
        note: Dasar batas diam 8 jam; digeser pada permintaan sah.
      - name: revokedAt
        type: datetime
        required: false
        note: Terisi saat logout, penonaktifan akun, atau penggantian kata sandi.
    constraints:
      - Sesi kedaluwarsa dan sesi yang sudah dicabut tidak pernah menjawab sebagai sesi valid.
    relationships:
      - target: User
        cardinality: "*..1"
        direction: Session milik satu User

  - name: LoginThrottle
    description: >
      Penghitung percobaan gagal per email, dihitung di database (Q4). Dipakai
      bersama oleh login dan verifikasi kata sandi lama pada ganti kata sandi
      (BR4.12). Berlaku sama untuk email yang tidak terdaftar sehingga pesan
      dan perilaku tidak membocorkan apakah email ada. Admin bisa membuka
      kunci satu email (BR4.18).
    attributes:
      - name: email
        type: string
        required: true
        unique: true
        note: Email yang diketik pada permintaan login, sudah dinormalisasi; bukan foreign key karena email bisa tidak terdaftar.
      - name: failedCount
        type: integer
        required: true
        default: 0
        min: 0
      - name: lockedUntil
        type: datetime
        required: false
      - name: updatedAt
        type: datetime
        required: true
    constraints: []
    relationships: []

  - name: AuditEvent
    description: >
      Catatan peristiwa akun yang hanya bisa ditambah, tidak pernah diubah,
      dan hanya dibaca admin (Q13). Tidak pernah memuat kata sandi, token,
      hash, atau isi cookie. Entri lebih tua dari 1 tahun dihapus otomatis
      (pengecualian tercatat terhadap NFR4, yang hanya mencakup data DDCL
      dan Library).
    attributes:
      - name: id
        type: string
        required: true
        unique: true
      - name: occurredAt
        type: datetime
        required: true
      - name: type
        type: enum
        required: true
        allowed_values: [login_success, login_failed, login_locked, logout, account_created, role_changed, account_deactivated, password_changed, password_reset_by_admin, lockout_cleared_by_admin]
      - name: actorUserId
        type: string
        required: false
        references: User
        note: Pelaku. Kosong untuk login gagal pada email yang tidak terdaftar.
      - name: targetUserId
        type: string
        required: false
        references: User
        note: Akun sasaran bila berbeda dari pelaku.
      - name: email
        type: string
        required: false
        note: Email yang diketik pada peristiwa login atau kunci; diisi walau tidak terdaftar.
      - name: ipAddress
        type: string
        required: false
      - name: detail
        type: string
        required: false
        max: 500
        note: Keterangan ringkas, mis. role lama dan baru. Tanpa rahasia.
    constraints:
      - Hanya penambahan; tidak ada pembaruan dan tidak ada penghapusan selain pembersihan retensi 1 tahun.
    relationships:
      - target: User
        cardinality: "*..1 (opsional)"
        direction: AuditEvent menunjuk User sebagai pelaku dan atau sasaran bila ada

  - name: DdclDocument
    description: >
      Entitas milik U1/U3, diperluas di sini hanya pada field pembuat.
      `createdBy` (string stub "dev-user") diganti `createdByUserId`.
    attributes:
      - name: createdByUserId
        type: string
        required: true
        references: User
        note: Diisi dari sesi saat DDCL dibuat. DDCL lama (nilai stub dev-user) diisi User admin pertama lewat migrasi (BR4.16). Dipakai U5 untuk kolom pembuat.
    constraints: []
    relationships:
      - target: User
        cardinality: "*..1"
        direction: DdclDocument dibuat oleh satu User
```

## Ringkasan entitas

| Entitas | Pemilik | Intinya |
|---|---|---|
| User | UserAccount (U4) | Akun dengan email, hash kata sandi, role, status aktif/nonaktif; tidak pernah dihapus |
| Session | UserAccount (U4) | Sesi login berbasis token acak yang disimpan sebagai hash, bisa dicabut |
| LoginThrottle | UserAccount (U4) | Penghitung percobaan gagal (login dan kata sandi lama) per email untuk penguncian 15 menit |
| AuditEvent | UserAccount (U4) | Catatan peristiwa akun hanya-tambah, dibaca admin, retensi 1 tahun |
| DdclDocument | DdclDocument (U1/U3) | Hanya field `createdByUserId` yang berubah di U4 |
