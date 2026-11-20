# Contract Design — Questions

## Sources

- [memory] `unit-of-work.md`, `unit-of-work-dependency.md` (Units Generation): 6 Unit, integrasi antar-Unit backend lewat modul internal (Q4), API publik hanya backend<->frontend.
- [memory] `components.md` (Domain Design).
- [memory] `requirements.md`: tidak ada integrasi otomatis ke sistem lain di v1 (Out of Scope).

## Q1. [Arsitek] Apakah benar tidak ada API publik/eksternal yang dikonsumsi di luar sistem ini (tidak ada partner, tidak ada integrasi otomatis ke sistem lain), sehingga satu-satunya batas formal yang perlu kontrak adalah backend<->frontend milik portal ini sendiri?

- A. Benar — tidak ada API publik/eksternal; hanya kontrak backend<->frontend yang perlu dirancang
- B. Ada permukaan API eksternal yang perlu dirancang (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q2. [Arsitek] Apakah mekanisme integrasi backend<->frontend cukup REST/HTTP sinkron (JSON) untuk seluruh 6 Unit, mengingat tidak ada kebutuhan event-driven/async (tidak ada notifikasi real-time, tidak ada integrasi antar-sistem)?

- A. Setuju — REST/HTTP sinkron untuk semua boundary backend<->frontend
- B. Ada boundary yang perlu mekanisme lain (sebutkan, mis. WebSocket untuk notifikasi lock)
- X. Other (please specify)

[Answer]: A

## Q3. [Arsitek] Apakah kepemilikan kontrak (siapa memiliki spesifikasi endpoint) cukup mengikuti Unit yang sudah ditetapkan di Units Generation — mis. endpoint Library dimiliki u2-step-library, endpoint komposisi DDCL dimiliki u3-ddcl-composition, dst.?

- A. Setuju — kepemilikan kontrak mengikuti Unit pemilik fitur masing-masing
- B. Kepemilikan berbeda (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q4. [Arsitek] Untuk versi dan kebijakan perubahan API, apakah cukup: prefix URL `/api/v1` (perubahan besar/breaking butuh versi baru), dan field baru di response JSON selalu aman ditambahkan (consumer mengabaikan field yang tidak dikenal)?

- A. Setuju — URL versioning `/api/v1`, additive field aman, breaking change butuh versi baru
- B. Kebijakan versi lain (sebutkan)
- X. Other (please specify)

[Answer]: A

## Q5. [Arsitek] Untuk error, timeout, dan retry di tiap boundary backend<->frontend, apakah cukup: status HTTP standar (400 validasi, 401 belum login, 403 tidak berhak, 404 tidak ditemukan, 409 konflik lock/duplikat, 422 data tidak lengkap untuk ekspor, 500 error server), tanpa retry otomatis dari frontend kecuali untuk request GET yang idempotent?

- A. Setuju — status HTTP standar di atas, retry otomatis hanya untuk GET idempotent
- B. Perilaku berbeda (sebutkan)
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
