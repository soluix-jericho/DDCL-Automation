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
                      role: { type: string, enum: [admin, editor, viewer] }
          headers:
            Set-Cookie:
              description: "ddcl_session=<token>; HttpOnly; SameSite=Lax; Path=/ (Secure bila COOKIE_SECURE aktif; tanpa Max-Age). Token yang sama ada di sessionToken dan boleh dikirim sebagai Authorization: Bearer"
              schema: { type: string }
        "400":
          description: Email atau kata sandi kosong atau bentuknya tidak valid (fields menyebut yang bermasalah)
        "401":
          description: "Kredensial salah, email tidak terdaftar, atau akun nonaktif (jawaban generik yang sama)"
        "403":
          description: Origin permintaan tidak ada di ALLOWED_ORIGINS
        "429":
          description: Email terkunci 15 menit setelah 5 kegagalan beruntun (header Retry-After, kata sandi tidak diperiksa)
        "503":
          description: Antrean hash penuh (header Retry-After)
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
                  role: { type: string, enum: [admin, editor, viewer] }
        "401":
          description: Belum login
  /api/v1/auth/password:
    post:
      summary: Ganti kata sandi sendiri (semua role); sesi lain pengguna itu dicabut
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [currentPassword, newPassword]
              properties:
                currentPassword: { type: string }
                newPassword: { type: string, minLength: 10, maxLength: 128 }
      responses:
        "204": { description: Kata sandi diganti }
        "400": { description: Kata sandi lama tidak cocok (dihitung ke penguncian), kata sandi baru tidak sah atau sama dengan yang lama }
        "401": { description: Belum login }
        "429": { description: Email terkunci (Retry-After) }
  /api/v1/users:
    get:
      summary: Daftar akun (admin)
      responses:
        "200":
          description: Larik akun
          content:
            application/json:
              schema:
                type: array
                items: { $ref: "#/components/schemas/User" }
        "401": { description: Belum login }
        "403": { description: Bukan admin }
    post:
      summary: Buat akun (admin)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, email, role, password]
              properties:
                name: { type: string, minLength: 1, maxLength: 100 }
                email: { type: string, maxLength: 254 }
                role: { type: string, enum: [admin, editor, viewer] }
                password: { type: string, minLength: 10, maxLength: 128 }
      responses:
        "201": { description: Akun dibuat (tanpa hash), content: { application/json: { schema: { $ref: "#/components/schemas/User" } } } }
        "400": { description: Isian tidak sah (fields) }
        "401": { description: Belum login }
        "403": { description: Bukan admin }
        "409": { description: Email sudah terdaftar, termasuk akun nonaktif }
  /api/v1/users/{id}:
    patch:
      summary: Ubah role dan atau status (admin); hanya field role dan status
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                role: { type: string, enum: [admin, editor, viewer] }
                status: { type: string, enum: [inactive] }
      responses:
        "200": { description: Akun setelah perubahan; juga untuk perubahan yang tidak mengubah apa pun (idempoten) }
        "400": { description: Isi kosong, field selain role dan status, atau nilai tidak sah }
        "401": { description: Belum login }
        "403": { description: Bukan admin }
        "404": { description: Akun tidak ada }
        "409": { description: Menonaktifkan diri sendiri, admin aktif terakhir diturunkan atau dinonaktifkan, atau status active pada akun nonaktif }
  /api/v1/users/{id}/password:
    post:
      summary: Atur ulang kata sandi akun lain (admin); semua sesinya dicabut dan kunci loginnya dibuka
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [newPassword]
              properties:
                newPassword: { type: string, minLength: 10, maxLength: 128 }
      responses:
        "204": { description: Kata sandi diatur ulang }
        "400": { description: Kata sandi tidak sah }
        "401": { description: Belum login }
        "403": { description: Bukan admin }
        "404": { description: Akun tidak ada }
        "409": { description: Akun sendiri (pakai POST /auth/password) }
  /api/v1/users/{id}/unlock:
    post:
      summary: Buka kunci login satu email (admin); idempoten
      responses:
        "204": { description: Kunci dibuka }
        "401": { description: Belum login }
        "403": { description: Bukan admin }
        "404": { description: Akun tidak ada }
  /api/v1/audit-events:
    get:
      summary: Catatan audit akun, hanya baca (admin), terbaru lebih dulu
      parameters:
        - { name: type, in: query, schema: { type: string } }
        - { name: from, in: query, schema: { type: string, format: date } }
        - { name: to, in: query, description: "Tanggal tanpa jam mencakup seluruh hari itu", schema: { type: string, format: date } }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
        - { name: cursor, in: query, description: "nextCursor dari halaman sebelumnya", schema: { type: string } }
      responses:
        "200":
          description: Satu halaman peristiwa
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      type: object
                      properties:
                        id: { type: string }
                        occurredAt: { type: string, format: date-time }
                        type: { type: string }
                        actorUserId: { type: string, nullable: true }
                        targetUserId: { type: string, nullable: true }
                        email: { type: string, nullable: true }
                        ipAddress: { type: string, nullable: true }
                        detail: { type: string, nullable: true }
                  nextCursor: { type: string, nullable: true }
        "400": { description: Filter tidak sah (fields menyebut yang bermasalah) }
        "401": { description: Belum login }
        "403": { description: Bukan admin }
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        email: { type: string }
        role: { type: string, enum: [admin, editor, viewer] }
        status: { type: string, enum: [active, inactive] }
        createdAt: { type: string, format: date-time }
        lastLoginAt: { type: string, format: date-time, nullable: true }
```

**Pembawa sesi dan pemeriksaan (berlaku untuk semua `/api/v1/*`, Contract 1 sampai 5):** sesi dibawa cookie `ddcl_session` (httpOnly, dipakai frontend) atau header `Authorization: Bearer <sessionToken>` (bila keduanya ada, Bearer dipakai). Permintaan tulis yang diautentikasi lewat cookie, atau tanpa sesi (login), dan membawa header `Origin` di luar `ALLOWED_ORIGINS` dijawab `403`; permintaan Bearer melewati pemeriksaan Origin. Sesi berlaku 8 jam sejak aktivitas terakhir dengan batas mutlak 7 hari.

**Respons tambahan pada Contract 2–5 (tanpa mengubah bentuk yang sudah ada):** `401` `{ "error": "unauthorized" }` tanpa sesi valid, `403` `{ "error": "forbidden" }` bila role di bawah role minimal rute, `429` tidak berlaku di luar login dan ganti kata sandi, dan `503` `service_busy` tetap seperti semula. Role minimal: semua `GET` dan ekspor = viewer; `POST`/`PATCH` Library dan DDCL = editor; `DELETE` step dan bundle (dan DDCL pada U3) = admin. `createdBy` pada respons DDCL kini nama pembuat dan `createdByUserId` ikut dikembalikan.

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
        Diperbarui di u2-step-library (Code Generation): daftar hanya memuat
        ringkasan (tanpa teks langkah dan isi lampiran, NFR1.11); isi penuh lewat
        `GET /api/v1/steps/{id}`. Pencarian dan filter dilakukan di server (BR2.13).
      parameters:
        - name: q
          in: query
          description: Cari nama (tanpa membedakan huruf besar/kecil, maksimal 200 karakter); `%`, `_`, dan `\` dicocokkan apa adanya
          schema: { type: string, maxLength: 200 }
        - name: category
          in: query
          schema: { type: string, enum: [Database, Bastion, RabbitMQ, Keycloak] }
      responses:
        "200":
          description: Daftar ringkasan step (kosong bila tidak ada yang cocok, bukan error)
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
                    columnCount: { type: integer }
                    attachmentCount: { type: integer }
                    usageCount: { type: integer, description: Jumlah DDCL berbeda yang memakai step (BR2.6) }
                    missingRollback: { type: boolean, description: "Forward tanpa pasangan rollback (BR2.10)" }
        "400":
          description: Parameter `q` atau `category` tidak sah
    post:
      summary: Buat step baru (FR2.2 — juga dipanggil dari layar komposisi DDCL)
      description: >-
        Batas input (NFR1.8): maksimal 10 kolom, 50 langkah per kolom, 2.000 karakter per
        langkah, nama 200 karakter, label kolom 200, maksimal 10 lampiran (nama file 255
        karakter, isi 102.400 byte UTF-8). Kurung kurawal di teks langkah: `{nama}` adalah
        variabel, `{{` dan `}}` kurung literal, selain itu ditolak (BR2.4). `bodyLimit` rute
        tulis Library 24 MiB; lebih dari itu 413. Maksimal 4 permintaan tulis serentak;
        yang ke-5 dijawab 503 dengan `Retry-After: 2` tanpa membaca body.
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, category, kind, columns]
              properties:
                name: { type: string }
                category: { type: string, enum: [Database, Bastion, RabbitMQ, Keycloak] }
                kind: { type: string, enum: [forward, rollback] }
                columns:
                  type: array
                  description: Kolom berurutan; langkah dan kolom kosong dibuang sebelum disimpan, minimal satu langkah tersisa
                  items:
                    type: object
                    properties:
                      label: { type: string, nullable: true }
                      lines: { type: array, items: { type: string } }
                attachments:
                  type: array
                  items:
                    type: object
                    required: [filename, content]
                    properties:
                      filename: { type: string, description: "Tanpa / \\ atau .., unik tanpa membedakan huruf besar/kecil" }
                      content: { type: string }
                pairedRollbackStepId: { type: string, nullable: true, description: Hanya untuk kind forward; menunjuk step rollback yang ada }
                rollbackStep:
                  type: object
                  description: Isi lengkap step rollback baru yang dibuat dan dipasangkan atomik (tanpa pairedRollbackStepId)
      responses:
        "201":
          description: Step dibuat; respons memuat step penuh (id, name, category, kind, pairedRollbackStepId, columns, attachments, variables, createdAt, updatedAt)
        "400":
          description: "Validasi gagal; `fields` memuat path field bermasalah, mis. `columns[1].lines[0]`, `rollbackStep.name`"
        "409":
          description: >-
            Nama sama dengan step lain yang kategori dan jenisnya sama (tanpa membedakan huruf besar/kecil).
            Memuat `existing` (isi penuh step yang ada) dan `conflictOn` (`step` atau `rollbackStep`). Tidak ada step tersimpan.
            Juga dipakai untuk `error: retry` (benturan transaksi setelah pengulangan; coba simpan lagi)
        "413":
          description: Body melebihi 24 MiB
        "503":
          description: Terlalu banyak penulisan serentak atau pool koneksi habis; `Retry-After: 2`. Klien tidak mengulang otomatis
  /api/v1/steps/categories:
    get:
      summary: Daftar kategori tetap (FR2.1, BR2.12) — hanya label pengelompokan
      description: >-
        Bentuk berubah dari rancangan awal ("skema kategori object/parameter per jenis step"):
        kini array `{ name }` untuk empat kategori tanpa daftar isian. Isian yang diminta saat step
        dipasang mengikuti variabel `{nama}` di teks langkah (keputusan Q10). Tidak ada pemakai
        endpoint ini di U1.
      responses:
        "200":
          description: "[{ name: Database }, { name: Bastion }, { name: RabbitMQ }, { name: Keycloak }]"
  /api/v1/steps/{id}:
    get:
      summary: Isi penuh satu step (kolom, langkah, lampiran, variabel turunan)
      responses:
        "200":
          description: Step penuh
        "404":
          description: Step tidak ditemukan
    patch:
      summary: Edit step, termasuk menetapkan/mengedit pasangan rollback (US1.3)
      description: >-
        Mengganti seluruh kolom, langkah, dan lampiran dalam satu transaksi (terakhir menang). Body sama
        dengan POST, tetapi `kind` boleh dihilangkan dan tidak bisa diubah (400, field `kind`). `pairedRollbackStepId`
        dihilangkan = pasangan tidak berubah, `null` = pasangan dikosongkan, id = pasangan diganti. DDCL yang sudah
        memakai step ini tidak berubah (snapshot per item checklist, BR2.8).
      responses:
        "200":
          description: Step diperbarui (step penuh)
        "400":
          description: Validasi gagal
        "404":
          description: Step tidak ditemukan
        "409":
          description: Nama bentrok dengan step lain (isi seperti POST), atau benturan transaksi
        "413":
          description: Body melebihi 24 MiB
        "503":
          description: Terlalu banyak penulisan serentak atau pool koneksi habis
    delete:
      summary: Hapus step dari Library (FR2.4 — tidak menyentuh DDCL yang sudah memakai snapshotnya)
      description: >-
        Selalu diizinkan bila step ada (BR2.7). Mengosongkan pairedRollbackStepId pada step forward yang menunjuknya,
        mengeluarkannya dari bundle (bundle yang kehilangan anggota forward terakhir ikut dihapus), dan mengosongkan
        `stepId` item checklist tanpa menyentuh `stepSnapshot`. Diubah dari rancangan awal: 200 dengan laporan dampak
        (bukan 204), sesuai "respons melaporkan dampaknya".
      responses:
        "200":
          description: "{ id, impact: { usageCount, checklistItems, bundlesRemoved: [{id,name}], bundlesChanged: [{id,name}], pairLost: [{id,name}] } }"
        "404":
          description: Step tidak ditemukan (juga bila dihapus orang lain lebih dulu)
        "503":
          description: Terlalu banyak penulisan serentak atau pool koneksi habis
  /api/v1/steps/{id}/impact:
    get:
      summary: Pratinjau dampak penghapusan (hanya baca), dipakai layar sebelum konfirmasi (Alur 4 langkah 1)
      responses:
        "200":
          description: Objek `impact` yang sama dengan hasil DELETE
        "404":
          description: Step tidak ditemukan
  /api/v1/bundles:
    get:
      summary: Daftar bundle (ringkasan) dengan `q` dan `category` seperti daftar step (BR2.13)
      responses:
        "200":
          description: "[{ id, name, category, forwardCount, rollbackCount, createdAt, updatedAt }]"
    post:
      summary: Buat bundle (BR2.11) — step forward berurutan dan rangkaian rollback berurutan sendiri, jumlah boleh berbeda
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, forwardStepIds]
              properties:
                name: { type: string, maxLength: 200 }
                category: { type: string, nullable: true, enum: [Database, Bastion, RabbitMQ, Keycloak] }
                forwardStepIds: { type: array, minItems: 1, maxItems: 50, items: { type: string }, description: "Step ber-kind forward; urutan = urutan simpan" }
                rollbackStepIds: { type: array, maxItems: 50, items: { type: string }, description: "Step ber-kind rollback; boleh kosong dan boleh berbeda jumlahnya" }
      responses:
        "201":
          description: Bundle penuh (anggota forward dan rollback berurutan, masing-masing dengan isi penuh step)
        "400":
          description: Nama kosong, tidak ada anggota forward, anggota salah jenis atau tidak ada, atau step ganda
        "409":
          description: Nama bundle sama (tanpa membedakan huruf besar/kecil); memuat `existing` dan `conflictOn` = bundle
        "413":
          description: Body melebihi 24 MiB
        "503":
          description: Terlalu banyak penulisan serentak atau pool koneksi habis
  /api/v1/bundles/{id}:
    get:
      summary: Bundle penuh untuk dibaca U3 (BR2.14) — rollback bundle berdiri sendiri, dalam urutan tersimpan
      responses:
        "200":
          description: "{ id, name, category, forward: [step penuh], rollback: [step penuh], createdAt, updatedAt }"
        "404":
          description: Bundle tidak ditemukan
    patch:
      summary: Ubah nama, kategori, anggota, dan urutan bundle (body sama dengan POST)
      responses:
        "200":
          description: Bundle penuh
        "400":
          description: Validasi gagal
        "404":
          description: Bundle tidak ditemukan
        "409":
          description: Nama bentrok dengan bundle lain
    delete:
      summary: Hapus bundle (step di dalamnya tidak ikut terhapus)
      responses:
        "200":
          description: "{ id, name, forwardCount, rollbackCount }"
        "404":
          description: Bundle tidak ditemukan
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
