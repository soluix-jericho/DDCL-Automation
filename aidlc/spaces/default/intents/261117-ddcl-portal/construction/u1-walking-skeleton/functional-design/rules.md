# Functional Design — u1-walking-skeleton — Business Rules

Sumber: `requirements.md` (FR2, FR6, FR7, FR7.1), `stories.md` (AC1.1.1, AC1.1.3, AC4.1.1, AC4.1.2), jawaban `functional-design-questions.md` Q2–Q6, `aidlc/spaces/default/memory/phases/construction.md` ## Error Handling.

```yaml
rules:
  - id: BR1.1
    statement: Membuat step wajib mengisi nama dan kategori; keduanya tidak boleh kosong.
    category: validation
    applies_to: Step
    trigger: Permintaan membuat step baru (POST /api/v1/steps)
    logic: "IF name kosong ATAU category kosong THEN tolak permintaan dengan 400 dan sebutkan field mana yang kosong"
    violation_behaviour: Permintaan ditolak, status HTTP 400, tidak ada Step yang tersimpan.
    source: FR2, AC1.1.1, AC1.1.3

  - id: BR1.2
    statement: DdclDocument yang baru dibuat di skeleton ini selalu berstatus "Draft".
    category: constraint
    applies_to: DdclDocument
    trigger: Permintaan membuat DDCL baru (POST /api/v1/ddcls)
    logic: "IF DdclDocument dibuat THEN status diisi \"Draft\" secara tetap (tidak ada pilihan status lain di skeleton)"
    violation_behaviour: Tidak berlaku — tidak ada jalur untuk membuat DDCL dengan status lain di Unit ini.
    source: FR6 (lingkup skeleton)

  - id: BR1.3
    statement: createdBy pada DdclDocument diisi nilai stub tetap, bukan referensi ke akun pengguna nyata.
    category: policy
    applies_to: DdclDocument
    trigger: Permintaan membuat DDCL baru
    logic: "IF DdclDocument dibuat THEN createdBy = \"dev-user\" (konstanta, bukan foreign key)"
    violation_behaviour: Tidak berlaku.
    source: Keputusan Functional Design Q2 (UserAccount/U4 belum dibangun)

  - id: BR1.4
    statement: Ekspor Excel gagal dengan pesan jelas jika file template tidak ditemukan atau tidak bisa dibaca.
    category: validation
    applies_to: ExcelExportService
    trigger: Permintaan ekspor (GET /api/v1/ddcls/{id}/export)
    logic: "IF file template tidak ditemukan ATAU gagal dibaca THEN tolak permintaan, sebutkan path template yang diharapkan, dan jangan hasilkan file apa pun"
    violation_behaviour: Permintaan gagal dengan pesan jelas; tidak ada file Excel setengah jadi ditulis ke disk atau dikirim ke klien.
    source: ADR-005 (Contract Design), keputusan Functional Design Q4, `phases/construction.md` ## Error Handling

  - id: BR1.5
    statement: Setiap permintaan yang gagal karena database tidak bisa diakses mengembalikan error generik ke klien dan mencatat detail di log server.
    category: policy
    applies_to: Semua endpoint skeleton (steps, ddcls, checklist-items)
    trigger: Operasi database gagal karena koneksi tidak tersedia
    logic: "IF koneksi database gagal THEN kembalikan 500 dengan pesan generik ke klien DAN catat detail error (termasuk query/operasi yang gagal) di log server"
    violation_behaviour: Klien tidak pernah menerima detail koneksi database; tidak ada data yang tersimpan sebagian.
    source: Keputusan Functional Design Q5, `phases/construction.md` ## Error Handling, ## Security (jangan membocorkan detail infrastruktur ke klien)

  - id: BR1.6
    statement: Nilai object/parameter ditulis ke sel Excel apa adanya, tanpa sanitasi karakter formula-like.
    category: policy
    applies_to: ExcelExportService
    trigger: Ekspor Excel menulis nilai parameter ke sel
    logic: "IF nilai parameter ditulis ke sel THEN tulis apa adanya (tidak ada escaping/sanitasi karakter seperti '=' di awal)"
    violation_behaviour: Tidak berlaku di skeleton — kasus tepi ini (AC4.1.5) sepenuhnya cakupan U6.
    source: FR7.1, keputusan Functional Design Q6 (ditunda ke u6-excel-export-hardening)

  - id: BR1.7
    statement: Label tab layar komposisi DDCL yang ditampilkan ke pengguna mengikuti tanggal yang diisi di Release Header.
    category: calculation
    applies_to: DdclDocument, ReleaseHeader
    trigger: Layar komposisi DDCL ditampilkan setelah header diisi
    logic: "IF ReleaseHeader.date terisi THEN label tab yang ditampilkan = ReleaseHeader.date (tampilan, bukan field tersimpan terpisah dari DdclDocument.title)"
    violation_behaviour: Tidak berlaku — ini aturan tampilan, bukan validasi yang bisa gagal.
    source: FR1.1
```

## Ringkasan Aturan

| ID | Kategori | Berlaku untuk | Pernyataan singkat |
|---|---|---|---|
| BR1.1 | validation | Step | Nama & kategori wajib diisi |
| BR1.2 | constraint | DdclDocument | Status selalu "Draft" saat dibuat |
| BR1.3 | policy | DdclDocument | createdBy = stub "dev-user" |
| BR1.4 | validation | ExcelExportService | Gagal jelas jika template tidak terbaca |
| BR1.5 | policy | Semua endpoint | Error generik ke klien saat DB tidak terjangkau |
| BR1.6 | policy | ExcelExportService | Nilai parameter ditulis apa adanya (sanitasi = U6) |
| BR1.7 | calculation | DdclDocument, ReleaseHeader | Label tab mengikuti tanggal Release Header |

## Assumptions & Open Questions

None.
