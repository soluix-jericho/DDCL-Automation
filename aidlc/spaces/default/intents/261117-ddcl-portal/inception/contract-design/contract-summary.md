# Contract Design — Ringkasan Kontrak

Sumber: `unit-of-work.md`, `unit-of-work-dependency.md` (Units Generation — seluruh integrasi antar-Unit backend adalah modul internal; satu-satunya batas yang butuh kontrak formal adalah backend<->frontend), `components.md` (Domain Design — bentuk entitas menentukan payload), `requirements.md` (NFR1/NFR2 menentukan SLA dan kontrol akses), jawaban `contract-design-questions.md` (Q1–Q5).

Tidak ada API publik/eksternal yang dikonsumsi di luar sistem ini (Q1). Satu-satunya kelas batas formal pada produk ini adalah backend<->frontend milik portal sendiri, dan seluruhnya memakai mekanisme yang sama: REST/HTTP sinkron, payload JSON (Q2). Kontrak dikelompokkan di bawah per area fitur, sesuai Unit pemiliknya (Q3).

## Contracts Table

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| 1 | u4-user-accounts | Frontend (portal) | REST/HTTP (JSON) | u4-user-accounts |
| 2 | u2-step-library (diperluas dari u1-walking-skeleton) | Frontend (portal) | REST/HTTP (JSON) | u2-step-library |
| 3 | u3-ddcl-composition (diperluas dari u1-walking-skeleton) | Frontend (portal) | REST/HTTP (JSON) | u3-ddcl-composition |
| 4 | u1-walking-skeleton (diperkeras oleh u6-excel-export-hardening) | Frontend (portal) | REST/HTTP (JSON request, binary xlsx response) | u1-walking-skeleton; validasi tambahan oleh u6-excel-export-hardening |
| 5 | u5-portal-reporting | Frontend (portal) | REST/HTTP (JSON) | u5-portal-reporting |

Setiap boundary mewajibkan sesi login valid (NFR2), kecuali `POST /api/v1/auth/login` sendiri. Sebelum U4 selesai, seluruh endpoint di baris 2–4 berjalan di balik sesi dev-mode satu pengguna tetap (lihat `unit-of-work.md` U1 Boundaries); U4 mencabut stub ini dan menegakkan sesi nyata di endpoint yang sama, tanpa mengubah bentuk kontrak baris 2–4.

## Contract 1 — Auth API (u4-user-accounts)

```yaml
openapi: "3.0.3"
info:
  title: DDCL Portal — Auth API
  version: "1.0.0"
paths:
  /api/v1/auth/login:
    post:
      summary: Login dan mulai sesi
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string }
                password: { type: string }
      responses:
        "200":
          description: Login berhasil
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessionToken: { type: string }
                  user:
                    type: object
                    properties:
                      id: { type: string }
                      name: { type: string }
                      email: { type: string }
        "401":
          description: Kredensial salah
  /api/v1/auth/logout:
    post:
      summary: Akhiri sesi aktif
      responses:
        "204":
          description: Berhasil logout
        "401":
          description: Tidak ada sesi aktif
  /api/v1/auth/me:
    get:
      summary: Identitas pengguna yang sedang login
      responses:
        "200":
          description: Pengguna aktif
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  name: { type: string }
                  email: { type: string }
        "401":
          description: Belum login
```

## Contract 2 — Step Library API (u2-step-library)

```yaml
openapi: "3.0.3"
info:
  title: DDCL Portal — Step Library API
  version: "1.0.0"
paths:
  /api/v1/steps:
    get:
      summary: Daftar step, termasuk jumlah DDCL yang memakainya (FR2.3)
      description: >-
        Field `usageCount` digabungkan di lapisan endpoint ini, bukan dimiliki
        StepLibrary maupun DdclDocument (ADR-002) — endpoint memanggil
        StepLibrary untuk daftar step lalu DdclDocument untuk menghitung
        pemakaian per step, dan menggabungkan hasilnya sebelum dikirim.
      responses:
        "200":
          description: Daftar step
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id: { type: string }
                    name: { type: string }
                    category: { type: string }
                    kind: { type: string, enum: [forward, rollback] }
                    pairedRollbackStepId: { type: string, nullable: true }
                    usageCount: { type: integer }
    post:
      summary: Buat step baru (FR2.2 — juga dipanggil dari layar komposisi DDCL)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, category, kind]
              properties:
                name: { type: string }
                category: { type: string }
                kind: { type: string, enum: [forward, rollback] }
                pairedRollbackStepId: { type: string, nullable: true }
      responses:
        "201":
          description: Step dibuat
        "409":
          description: Nama step duplikat di kategori yang sama
  /api/v1/steps/categories:
    get:
      summary: Skema kategori object/parameter per jenis step (FR2.1)
      responses:
        "200":
          description: Daftar kategori dan field object/parameter-nya
  /api/v1/steps/{id}:
    patch:
      summary: Edit step, termasuk menetapkan/mengedit pasangan rollback (US1.3)
      responses:
        "200":
          description: Step diperbarui
        "404":
          description: Step tidak ditemukan
    delete:
      summary: Hapus step dari Library (FR2.4 — tidak menyentuh DDCL yang sudah memakai snapshotnya)
      responses:
        "204":
          description: Step dihapus dari Library
        "404":
          description: Step tidak ditemukan
```

## Contract 3 — DDCL Composition API (u3-ddcl-composition)

```yaml
openapi: "3.0.3"
info:
  title: DDCL Portal — DDCL Composition API
  version: "1.0.0"
paths:
  /api/v1/ddcls:
    get:
      summary: Lihat Contract 5 (Portal Reporting) untuk rekap/listing lintas-DDCL
    post:
      summary: Buat DDCL baru dengan header Release Document (FR1)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                title: { type: string }
                releaseHeader:
                  type: object
                  properties:
                    date: { type: string, format: date }
                    startDate: { type: string, format: date }
                    impactedSystem: { type: string }
                    environment: { type: string }
                    phaseRelease: { type: string }
                    releaseObjective: { type: string }
                    technicalChange: { type: string }
      responses:
        "201":
          description: DDCL dibuat, status Draft
  /api/v1/ddcls/{id}:
    get:
      summary: Ambil satu DDCL lengkap (header, checklist, rollback, capture, status, versi)
      responses:
        "200":
          description: DDCL lengkap
        "404":
          description: DDCL tidak ditemukan
    patch:
      summary: Edit header DDCL (butuh lock yang dipegang pengguna ini)
      responses:
        "200":
          description: DDCL diperbarui
        "403":
          description: DDCL read-only (sudah Sudah Dikirim)
        "409":
          description: DDCL sedang dikunci pengguna lain
  /api/v1/ddcls/{id}/checklist-items:
    post:
      summary: Tambah step dari Library ke checklist; rollback pasangannya otomatis ikut terpasang (FR4.1)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [stepId, order]
              properties:
                stepId: { type: string }
                order: { type: integer }
                parameterValues: { type: object }
      responses:
        "201":
          description: Checklist item (dan rollback item pasangannya) ditambahkan
        "409":
          description: DDCL sedang dikunci pengguna lain
  /api/v1/ddcls/{id}/checklist-items/{itemId}:
    patch:
      summary: Ubah urutan, duplikasi, atau nilai object/parameter baris step (FR3.1–FR3.3)
      responses:
        "200":
          description: Checklist item diperbarui
    delete:
      summary: Hapus baris step (dan rollback pasangannya) dari checklist
      responses:
        "204":
          description: Dihapus
  /api/v1/ddcls/{id}/capture-notes:
    post:
      summary: Catat bukti eksekusi per step (FR5, opsional)
      responses:
        "201":
          description: Capture note ditambahkan
  /api/v1/ddcls/{id}/submit:
    post:
      summary: Tandai status Draft -> Sudah Dikirim; DDCL menjadi read-only (FR6, FR6.1)
      responses:
        "200":
          description: Status diperbarui
        "409":
          description: DDCL sudah berstatus Sudah Dikirim
  /api/v1/ddcls/{id}/versions:
    post:
      summary: Buat versi baru (vN) dari DDCL yang sudah Sudah Dikirim (FR6.2) — vN dimulai dari status Draft
      responses:
        "201":
          description: Versi baru dibuat, `parentDdclId` menunjuk ke DDCL asal
        "403":
          description: DDCL asal belum berstatus Sudah Dikirim
  /api/v1/ddcls/{id}/lock:
    post:
      summary: Ambil lock edit (FR10) — durasi auto-release timeout (FR10.1) ditentukan di Functional Design
      responses:
        "200":
          description: Lock diambil
        "409":
          description: Sudah dikunci pengguna lain
    delete:
      summary: Lepas lock edit secara eksplisit
      responses:
        "204":
          description: Lock dilepas
```

## Contract 4 — Excel Export API (u1-walking-skeleton, diperkeras u6-excel-export-hardening)

```yaml
openapi: "3.0.3"
info:
  title: DDCL Portal — Excel Export API
  version: "1.0.0"
paths:
  /api/v1/ddcls/{id}/export:
    get:
      summary: Ekspor satu DDCL sebagai file Excel 1:1 dengan tata letak template (FR7)
      description: >-
        U1 menyediakan ekspor dasar (mapping sel minimal). U6 menambahkan
        validasi pra-ekspor dan penanganan kasus tepi pada endpoint yang sama,
        tanpa mengubah bentuk kontrak: AC4.1.3 (validasi kelengkapan DDCL,
        menolak dengan 422 jika belum lengkap), AC4.1.4 (step melebihi baris
        per fase tetap menghasilkan file valid), AC4.1.5 (nilai object/
        parameter yang diawali karakter formula-like ditulis sebagai teks
        biasa apa adanya).
      responses:
        "200":
          description: File Excel (.xlsx)
          content:
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet: {}
        "404":
          description: DDCL tidak ditemukan
        "422":
          description: DDCL belum lengkap untuk diekspor (ditambahkan u6)
```

## Contract 5 — Portal Reporting API (u5-portal-reporting)

```yaml
openapi: "3.0.3"
info:
  title: DDCL Portal — Reporting API
  version: "1.0.0"
paths:
  /api/v1/ddcls:
    get:
      summary: Rekap/listing semua DDCL dengan filter dan pencarian (FR8, FR8.1)
      description: Membaca data dari DdclDocument (u3), tidak memodifikasinya.
      parameters:
        - name: status
          in: query
          schema: { type: string }
        - name: dateFrom
          in: query
          schema: { type: string, format: date }
        - name: dateTo
          in: query
          schema: { type: string, format: date }
        - name: search
          in: query
          schema: { type: string }
          description: Pencarian berdasarkan judul
      responses:
        "200":
          description: Daftar DDCL dengan judul, pembuat, tanggal dibuat/dikirim, status
```

## Contract Ownership Rules

- Setiap spesifikasi endpoint dimiliki tepat satu Unit, mengikuti Unit yang memiliki fitur terkait di `unit-of-work.md` (Q3): Auth → u4-user-accounts; Library → u2-step-library; Komposisi DDCL → u3-ddcl-composition; Ekspor Excel → u1-walking-skeleton (validasi tambahan u6-excel-export-hardening); Reporting → u5-portal-reporting.
- Satu pengecualian yang sengaja tidak dimiliki Unit mana pun: field `usageCount` pada `GET /api/v1/steps` (FR2.3) digabungkan di lapisan endpoint itu sendiri, bukan logika StepLibrary maupun DdclDocument (ADR-002) — dicatat eksplisit di sini agar tidak dianggap milik salah satu komponen domain.
- Perubahan breaking (menghapus/mengganti bentuk field, mengubah method/path) butuh versi URL baru (`/api/v2`, dst.); field baru di response selalu aman ditambahkan tanpa versi baru, karena consumer (frontend) mengabaikan field yang tidak dikenal (Q4).
- Setiap endpoint mewajibkan sesi login valid (NFR2) kecuali `POST /api/v1/auth/login`; kredensial database tidak pernah melewati kontrak ini (kontrak hanya mendefinisikan permukaan HTTP ke frontend).
- Error, timeout, retry (Q5): status HTTP standar — 400 (validasi), 401 (belum login), 403 (tidak berhak/read-only), 404 (tidak ditemukan), 409 (konflik lock atau nama duplikat), 422 (data tidak lengkap untuk ekspor), 500 (error server). Tidak ada retry otomatis dari frontend, kecuali untuk request `GET` yang idempotent.
- Interaksi UI umum melalui kontrak-kontrak ini (simpan, buka DDCL, filter rekap) HARUS selesai di bawah 2 detik pada kondisi jaringan lokal normal (NFR1) — tidak ada SLA khusus per endpoint di luar target ini untuk v1.

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| Contract 3 (DDCL Composition) — `POST /ddcls/{id}/lock` | Durasi timeout auto-release lock (FR10.1) belum ditentukan angkanya | Functional Design harus menetapkan nilai konkret sebelum Code Generation u3-ddcl-composition |
| Contract 3 & Contract 5 | Apakah versi DDCL (vN) ditampilkan sebagai entri rekap terpisah atau dikelompokkan di bawah DDCL induknya | Functional Design (bentuk response `GET /ddcls` untuk Contract 5 bergantung pada keputusan ini) |

## Assumptions & Open Questions

None.
