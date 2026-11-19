# Personas — Portal DDCL Otomatis

Disepakati di `user-stories-questions.md` Q1: satu persona utama cukup untuk MVP.

## P1: Budi, Pembuat DDCL

| Atribut | Deskripsi |
|---|---|
| Peran | Anggota tim operasional/infrastruktur yang membuat Deployment Document Check List (DDCL) untuk setiap rilis produksi |
| Tujuan | Membuat DDCL baru secepat mungkin dengan menyusun ulang step/object yang sudah pernah dipakai, bukan mengetik dari nol; punya rekap DDCL yang pernah dibuat beserta statusnya |
| Titik sakit saat ini | Mengetik ulang step dan object yang polanya sama setiap kali ada rilis baru; tidak ada tempat terpusat yang merekap DDCL apa saja yang sudah dibuat, kapan dikirim, dan object apa saja yang dipakai |
| Kenyamanan teknologi | Menengah — terbiasa dengan istilah teknis operasional (database, Docker, Kubernetes) tapi bukan developer; mengharapkan antarmuka yang sederhana dan jelas |
| Frekuensi pemakaian | Setiap kali ada rilis produksi baru (berulang, bukan satu kali pakai) |

Catatan untuk v1: meski requirement FR9 mencatat portal harus mendukung lebih dari satu akun, untuk MVP praktis hanya Budi (satu pengguna) yang benar-benar memakai portal ini (Requirements Analysis Q4). Story terkait multi-pengguna (lock saat edit bersamaan) tetap ditulis sebagai persiapan kapabilitas inti, bukan diasumsikan dipakai sekarang.
