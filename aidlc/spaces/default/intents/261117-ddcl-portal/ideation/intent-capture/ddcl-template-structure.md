# DDCL BCAS PROD 202611 - TEMPLATE.xlsx — Struktur (hasil pembacaan file)

Transkrip struktur dari file Excel `DDCL BCAS PROD 202611 - TEMPLATE.xlsx` (dibaca langsung dari isi file, bukan dari penjelasan lisan). Dokumen ini punya 4 sheet.

## Sheet 1: "Release Document"

Halaman sampul/header rilis:
- Judul: "Release Document"
- Purpose: tujuan implementasi (mengacu ke requirement/change request)
- Details / Impacted System (nama sistem yang terdampak, mis. "CES")
- Date, Start Time, Environment (mis. PROD), Phase / Release #
- Release Objectives (daftar bernomor, mis. "1. Fixing Penjagaan Double Approval Supervisor")
- Technical Changes (seksi bebas)
- Change Impacts (seksi bebas)
- Sign-off: Prepared by / Reviewed by, dengan kolom Requester, Project Manager, Application Manager (nama + tanda tangan)

## Sheet 2: "Deployment Check List" — INI YANG BERISI "STEP"

- Judul halaman: "Deployment Document Check List <tanggal>"
- Baris toggle YES/NO: Update Image Required?, Update Configmap Required?, Update Secret Required?, Update Database, Backup Database, Update Ingress
- Tabel utama, kolom: **No | Activities | Date (Plan/Actual) | Time (Start/End/Duration, Plan & Actual) | PIC | Notes**
- Tabel dikelompokkan per fase: **Pre-Implementation**, **Implementation**, **Rollback & Recovery Plan**; dalam tiap fase ada sub-grup berdasarkan target (mis. "Bastion", "Database", "RabbitMQ")
- Setiap baris "Activities" (kolom B) = **satu STEP**: judulnya singkat (mis. "Update Workflow", "Update Deployment CES", "Backup DB table dbbcas-prod", "Run Database Querry - dbbcas-prod", "Enable/Disable Auto Migrate", "Restart Deployment") diikuti **prosedur bernomor** (instruksi command-line/console step-by-step).
- Banyak step isinya memuat kalimat yang merujuk ke sheet lain, contoh:
  - "...sesuai Sheet 'List Object & Parameter - 1.2 List Update Deployment'"
  - "...sesuai Sheet 'List Object & Parameter - 1.4 List Perubahan configmap'"
  - "...sesuai Sheet 'List Object & Parameter - 1.5 List Perubahan Secret'"
  - "...sesuai Sheet 'List Object & Parameter - 1.6 List Update Cronjob'"
  - "...sesuai Sheet 'List Object & Parameter - 1.8 List Update Workflow'"

  Inilah rujukan ke **"object"**: nilai-nilai konkret (nama image, versi, nama database, nama configmap, dsb.) yang berbeda-beda di setiap DDCL, sementara teks prosedur step-nya sendiri cenderung sama/berulang antar DDCL.
- Sign-off penutup: Implemented by (IT), Requester, Reviewed by (Application Manager), Acknowledge by (Project Manager)

## Sheet 3: "List Object & Parameter" — INI YANG BERISI "OBJECT"

Judul: "Implementation Items <tanggal>". Berisi beberapa sub-tabel bernomor, masing-masing adalah satu kategori **object**:

| Kategori Object | Kolom tabelnya |
|---|---|
| 1.1 List Image | No, Deployment, Image |
| 1.2 List Update Deployment | No, Deployment, Image, env-variable, Replicas |
| 1.3 List Update Database Collection | No, Database, Script File |
| 1.4 List Perubahan configmap | No, envi, value |
| 1.5 List Update Secret | No, env, var, Notes |
| 1.6 List Update Cronjob | No, Cronjob, Schedule, batchname, Secret |
| 1.7 List Update Document | No, Notes |
| 1.8 List Update Workflow | No, Script, Notes |

Setiap sub-tabel biasanya dipecah lagi per environment/namespace (mis. "ces-bcas-prod", "dataprod-bcas-prod", "ces-kbbrc-diacon", "migrasi-kbbrc") sebagai baris pengelompok, lalu baris-baris di bawahnya berisi data konkret (nama deployment, image tag versi, dsb).

Jadi: **step** = nama+prosedur aktivitas (relatif tetap / reusable), **object** = baris data konkret di salah satu kategori "List Object & Parameter" (berubah-ubah setiap DDCL: nama deployment, versi image, nama database, nama configmap/secret, nama cronjob, dsb.) yang dirujuk oleh step tersebut.

## Sheet 4: "Checklist Capture"

Kolom: **Step | Actual Time | Capture Before | Capture After**. Log bukti (screenshot/evidence) sebelum & sesudah setiap step dijalankan, dengan nomor step sebagai acuan.

## Catatan

Ini hasil pembacaan langsung isi file Excel (semua sheet, semua sel berisi teks). Data contoh di dalamnya (nama database, kredensial, alamat host, nama image, dsb.) adalah **isi dari satu DDCL historis** (bukan definisi kolom), hanya dipakai di sini untuk memahami pola struktur template, bukan untuk disalin ke desain sistem.
