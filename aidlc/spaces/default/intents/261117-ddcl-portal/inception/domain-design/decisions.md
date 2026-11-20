# Domain Design — Architecture Decision Records

Sumber: `requirements.md` (FR1–FR10, NFR2, NFR6), `domain-design-questions.md` (Q1–Q4).

## ADR-001: Dekomposisi 4 komponen logis

- **Context**: Sistem perlu dipecah menjadi building block kode yang jelas batas tanggung jawabnya, agar entitas (FR1–FR10) punya kepemilikan tunggal dan tidak ambigu.
- **Decision**: Empat komponen — UserAccount (identitas & sesi, FR9, NFR2), StepLibrary (step reusable + pasangan rollback, FR2, FR4 sisi Library), DdclDocument (komposisi DDCL, status, versi, lock, FR1, FR3, FR5, FR6, FR10), dan ExcelExportService (ekspor ke Excel, FR7).
- **Consequences**: Positif — tiap komponen punya satu concern dan lifecycle perubahan yang jelas; memudahkan Units Generation menentukan unit deployable. Negatif — DdclDocument menjadi komponen paling besar (jantung produk), perlu dipecah lebih halus secara internal (modul/package) di tahap implementasi agar tidak jadi satu file raksasa.
- **Alternatives Rejected**: Menggabungkan StepLibrary ke dalam DdclDocument (ditolak — step adalah aset lintas-DDCL dengan change rate berbeda, FR2.4 secara eksplisit menegaskan Library tidak terikat ke DDCL yang memakainya). Memecah DdclDocument lebih jauh menjadi komponen Checklist/Rollback/Capture terpisah di tahap ini (ditolak — ketiganya selalu berubah bersama sebagai satu DDCL dan dikonsumsi sebagai satu kesatuan oleh ExcelExportService; pemisahan lebih halus adalah detail internal, bukan batas komponen).

## ADR-002: Menghindari siklus StepLibrary <-> DdclDocument untuk jumlah pemakaian step (FR2.3)

- **Context**: Library perlu menampilkan jumlah DDCL yang memakai sebuah step (FR2.3) sebelum pengguna mengubah/menghapusnya, tapi data pemakaian (ChecklistItem) dimiliki oleh DdclDocument. Jika StepLibrary memanggil DdclDocument untuk hitung pemakaian, dan DdclDocument juga memanggil StepLibrary untuk ambil detail step saat komposisi checklist, muncul siklus dependensi.
- **Decision**: StepLibrary tidak memanggil DdclDocument sama sekali (`depends_on: []`). Penggabungan "daftar step dari StepLibrary" + "hitung pemakaian dari DdclDocument" dilakukan di lapisan API/endpoint yang memanggil kedua komponen secara terpisah lalu menggabungkan hasilnya sebelum dikirim ke frontend.
- **Consequences**: Positif — graf dependensi domain tetap asiklik dan satu arah (StepLibrary, UserAccount -> DdclDocument -> ExcelExportService), memudahkan Units Generation menentukan urutan/boundary deployable. Negatif — logika penggabungan jumlah pemakaian hidup di lapisan API/aplikasi, bukan di salah satu komponen domain; perlu didokumentasikan jelas di Contract Design agar tidak dianggap "milik" salah satu komponen.
- **Alternatives Rejected**: StepLibrary memanggil DdclDocument langsung untuk menghitung pemakaian (ditolak — membuat siklus dengan panggilan sebaliknya saat DdclDocument mengambil detail step). Menyimpan counter pemakaian ter-denormalisasi di dalam Step (ditolak untuk cakupan MVP ini — menambah kompleksitas sinkronisasi counter yang tidak diminta requirements, dan tetap perlu ditulis oleh sisi DdclDocument setiap kali step dipakai, yang kembali membuka jalur sisi lain dari siklus yang sama).

## ADR-003: Lock "sedang diedit" sebagai atribut DdclDocument

- **Context**: FR10 mewajibkan DDCL yang sedang diedit terkunci dari pengguna lain, dengan pelepasan otomatis setelah waktu tidak aktif (FR10.1, US6.1). Lock selalu terikat ke satu DDCL tertentu.
- **Decision**: Lock disimpan sebagai atribut pada entitas DdclDocument (`lockedBy`, `lockedAt`), bukan sebagai komponen "LockManager" generik terpisah.
- **Consequences**: Positif — tidak ada komponen tambahan untuk konsep yang selalu 1:1 dengan satu DDCL; logika pelepasan otomatis (timeout) tetap sederhana karena hidup bersama data yang dikuncinya. Negatif — jika di masa depan lock dibutuhkan untuk entitas lain (mis. Step di Library), pola ini harus diduplikasi, bukan dipakai ulang dari satu komponen lock generik.
- **Alternatives Rejected**: Komponen "LockManager" generik yang bisa mengunci entitas apa pun (ditolak untuk MVP — tidak ada kebutuhan mengunci entitas lain saat ini, FR10 hanya menyebut DDCL; menambah komponen untuk kasus pakai tunggal adalah abstraksi prematur).

## ADR-004: Versi DDCL sebagai self-reference pada DdclDocument

- **Context**: FR6.2 mewajibkan DDCL yang sudah "Sudah Dikirim" bisa menurunkan versi baru (v2, v3, ...) yang terhubung ke DDCL asalnya, dimulai dari status Draft.
- **Decision**: Setiap versi adalah DdclDocument biasa dengan atribut opsional `parentDdclId` yang menunjuk ke DdclDocument induknya (self-reference), bukan entitas/komponen "DdclVersion" terpisah.
- **Consequences**: Positif — seluruh perilaku DDCL (checklist, rollback, capture, lock, ekspor Excel) otomatis berlaku sama untuk versi baru tanpa logika khusus; rantai versi bisa ditelusuri lewat `parentDdclId` berulang. Negatif — pertanyaan terbuka di `requirements.md` (apakah versi ditampilkan terpisah atau dikelompokkan di bawah DDCL induknya di Portal Reporting) tetap perlu diputuskan di Functional Design, karena model ini membuat keduanya sama-sama mungkin secara data.
- **Alternatives Rejected**: Entitas/komponen "DdclVersion" terpisah yang menyimpan daftar versi dan menunjuk ke DdclDocument-DdclDocument sebenarnya (ditolak — menambah lapisan tidak langsung yang tidak diperlukan karena setiap versi pada dasarnya adalah DDCL penuh dengan seluruh perilakunya sendiri, bukan sekadar metadata versi).

## ADR-005: Pendekatan ekspor Excel — isi ulang template, bukan bangun dari nol

- **Context**: FR7 mewajibkan hasil ekspor 1:1 dengan tata letak `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (tata letak, pengelompokan baris per fase, format sel) — ditandai sebagai risiko teknis utama (NFR6, `feasibility-assessment.md`).
- **Decision**: ExcelExportService memuat file template yang sudah ada sebagai basis, lalu menulis nilai ke sel-sel yang sudah ditentukan posisinya (mapping sel per field/baris), bukan membangun ulang struktur dan styling dari nol dengan pustaka spreadsheet generik.
- **Consequences**: Positif — format asli (merge cell, lebar kolom, styling, pengelompokan baris per fase) otomatis terjaga karena berasal dari file sumber yang sama, meminimalkan risiko ketidakcocokan 1:1 yang diidentifikasi sebagai risiko utama. Negatif — mapping sel menjadi erat terikat ke struktur file template saat ini; perubahan template di masa depan mengharuskan mapping diperbarui secara manual, dan jumlah step yang melebihi baris yang disediakan template untuk satu fase (AC4.1.4) perlu penanganan baris tambahan yang tetap konsisten dengan format fase tersebut.
- **Alternatives Rejected**: Membangun ulang file Excel dari nol dengan pustaka spreadsheet umum yang mereplikasi styling template secara manual (ditolak — risiko ketidakcocokan styling/tata letak jauh lebih tinggi untuk mencapai kecocokan 1:1, dan menduplikasi pekerjaan styling yang sudah ada di file template asli). Pemilihan pustaka/kerangka kerja spesifik (nama paket) ditunda ke tahap implementasi (Code Generation) sebagai detail teknis, bukan keputusan arsitektur.
