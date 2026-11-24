## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261117-ddcl-portal/construction/u2-step-library/nfr-requirements/scalability-requirements.md > Konkurensi (dan reliability-requirements.md > NFR4.5) | Penguncian `SELECT ... FOR UPDATE` hanya disebut "pada baris Step", tanpa urutan kunci. PATCH atas step A yang menyentuh pasangan rollback B, DELETE yang mengosongkan pasangan, dan simpan bundle yang memuat banyak step dapat mengunci baris yang sama dalam urutan berlawanan, sehingga PostgreSQL menjawab deadlock (40P01). NFR4.5 menyatakan pelanggaran tidak pernah menjadi 500, tetapi deadlock tidak ada dalam daftar pemetaan. | Tetapkan urutan kunci yang pasti (mis. urut `id` naik, termasuk step pasangan dan semua anggota bundle) dan tambahkan pemetaan deadlock/serialization failure ke respons yang pasti (retry transaksi atau 409) di NFR4.5, beserta test dua transaksi bersilang. | New |
| R-02 | Major | aidlc/spaces/default/intents/261117-ddcl-portal/construction/u2-step-library/nfr-requirements/scalability-requirements.md > Pemicu Peningkatan Skala dan NFR4.2 (terkait NFR1.5 di performance-requirements.md) | NFR1.5 mewajibkan p95 < 2 detik dengan 100.000 item checklist yang dihitung lewat `usageCount`, tetapi indeks `ChecklistItem.stepId` hanya ditambahkan "jika melambat". Item membawa `stepSnapshot` sekitar 100 KB (hingga 10 GB), sehingga tanpa indeks agregasi berisiko memindai tabel sangat besar. Target dan syarat pencapaiannya tidak konsisten, dan tidak jelas apakah indeks itu sudah ada di skema U1. | Nyatakan apakah indeks `ChecklistItem.stepId` ada; bila tidak, jadikan indeks itu bagian dari migrasi U2 (bukan pemicu), dan pastikan test beban NFR1.5 dijalankan dengan snapshot berukuran realistis. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261117-ddcl-portal/construction/u2-step-library/nfr-requirements/performance-requirements.md > NFR1.10 | Ukuran maksimum sah dihitung sekitar 10 MB dengan `rollbackStep` inline, "belum termasuk overhead JSON", sementara `bodyLimit` 16 MiB. Selisihnya tidak dijamin untuk klien yang meng-escape karakter non-ASCII (`uXXXX`) sehingga payload sah bisa ditolak 413. | Hitung ukuran terburuk dengan escape JSON atau naikkan `bodyLimit`, dan masukkan kasus itu ke test NFR1.6. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261117-ddcl-portal/construction/u2-step-library/nfr-requirements/security-requirements.md > NFR2.9 | Perilaku `%` dan `_` pada `contains` Prisma dibuat bersyarat ("bila contains tidak meng-escape sendiri, escape manual ditambahkan"), sehingga keputusan implementasi ditunda ke test. | Putuskan sekarang: escape manual `%`, `_`, `` sebelum diberikan ke `contains`, dengan test wajib tetap dipertahankan. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261117-ddcl-portal/construction/u2-step-library/nfr-requirements/performance-requirements.md > Verifikasi (NFR1.5 sampai NFR1.7) | Test beban memakai 20 permintaan berurutan per rute untuk menghitung p95, sehingga p95 hanya ditentukan oleh sekitar satu sampel, dan tidak menguji konkurensi 20 pengguna dari NFR1.9. | Naikkan jumlah sampel (mis. 100) dan tambahkan skenario bersamaan sesuai NFR1.9. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261117-ddcl-portal/construction/u2-step-library/nfr-requirements/security-requirements.md > NFR2.6 dan Threat Considerations | Rute tulis Library menerima body hingga 16 MiB tanpa sesi, sehingga satu klien di jaringan yang sama dapat memakai memori backend secara berlebihan sampai u4 menegakkan sesi. Risiko dicatat sebagian, tanpa batas laju atau mitigasi sementara. | Catat risiko ini secara eksplisit sebagai syarat untuk u4 atau tambahkan batas sederhana (mis. batas permintaan serentak) untuk rute tulis. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Pembacaan manual ID NFR (NFR1.5 sampai NFR1.11, NFR2.6 sampai NFR2.9, NFR3.4 sampai NFR3.6, NFR4.2 sampai NFR4.7) | ID unik, melanjutkan penomoran U1 tanpa bentrok | Referensi silang antar berkas konsisten. |
| Tool validasi otomatis | Tidak dijalankan ulang pada pass ini | Artefak tidak berubah sejak pass sebelumnya; temuan di atas bersifat arsitektural, bukan struktural. |

### Summary

Dua temuan Major (urutan kunci dan deadlock yang tidak terpetakan, serta indeks `usageCount` yang ditunda padahal target NFR1.5 bergantung padanya) masih terbuka, tetapi jumlahnya tidak melebihi dua dan tidak ada Critical, sehingga NFR layak dilanjutkan dengan perbaikan tersebut. Temuan Minor tidak memblokir.
