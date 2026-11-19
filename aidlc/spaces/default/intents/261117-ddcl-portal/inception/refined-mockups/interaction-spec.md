# Interaction Specification — Portal DDCL Otomatis

Format mengikuti `.claude/knowledge/aidlc-design-agent/component-spec-template.md`. Hanya komponen baru/khusus (lihat `mockups.md`); komponen generik (tabel, form field, tombol) mengikuti pola standar di `wireframing-guide.md`.

---

## Lock Badge

| Field | Value |
|---|---|
| Component | LockBadge |
| Description | Menandai bahwa sebuah DDCL sedang dikunci karena diedit pengguna lain (US6.1) |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| hidden | DDCL tidak sedang dikunci | default |
| locked-by-other | Dikunci pengguna lain | pengguna lain membuka mode edit |
| locked-by-self | Dikunci oleh pengguna yang sedang login (dirinya sendiri) | pengguna sendiri sedang mengedit di tab/sesi lain |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| lockedBy | string \| null | yes | null | Nama pengguna yang mengunci; null berarti tidak terkunci |
| isSelf | boolean | no | false | True jika yang mengunci adalah pengguna yang sedang login |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| desktop (>1024px) | Badge penuh dengan ikon + teks "Sedang diedit oleh <nama>" |

(Tidak ada breakpoint lain — desktop-only per `refined-mockups-questions.md` Q4.)

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `status` (perubahan lock diumumkan tanpa memindah fokus) |
| Keyboard interaction | Tidak interaktif (murni informasi) |
| Label / aria-label | Teks "Sedang diedit oleh <nama>" terbaca langsung oleh screen reader via `aria-live="polite"` |
| Contrast ratio | WCAG AA (ikon gembok + teks, bukan warna saja) |
| Screen reader | Diumumkan saat status berubah dari tidak terkunci → terkunci |
| Focus management | Tidak mengambil fokus |

### Usage Example

```
<LockBadge lockedBy="Budi" isSelf={false} />
```

---

## Revision Button & Confirmation Dialog

| Field | Value |
|---|---|
| Component | RevisionDialog |
| Description | Memulai pembuatan versi baru (v2, v3, ...) dari DDCL yang sudah "Sudah Dikirim" (US3.2) |
| Category | feedback / navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | Dialog tertutup | DDCL berstatus Sudah Dikirim, tombol "Buat Revisi" terlihat |
| open | Dialog konfirmasi terbuka | klik "Buat Revisi" |
| loading | Membuat versi baru | klik "Ya, buat vN" |
| error | Gagal membuat versi baru | sistem gagal menyimpan |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| sourceDdclId | string | yes | — | ID DDCL asal |
| sourceTitle | string | yes | — | Judul DDCL asal, dipakai untuk menyusun judul versi baru |
| nextVersionLabel | string | yes | — | Label versi berikutnya (mis. "v2"), dihitung dari jumlah versi yang sudah ada |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| desktop (>1024px) | Dialog modal tengah layar, lebar tetap ~480px |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `dialog`, dengan `aria-modal="true"` |
| Keyboard interaction | Escape menutup dialog; Tab terjebak di dalam dialog selama terbuka |
| Label / aria-label | `aria-labelledby` menunjuk ke judul dialog "Buat versi baru dari DDCL ini?" |
| Contrast ratio | WCAG AA |
| Screen reader | Judul dan isi dialog dibacakan saat dialog terbuka |
| Focus management | Fokus pindah ke tombol "Ya, buat vN" saat dialog terbuka; kembali ke tombol "Buat Revisi" saat ditutup/dibatalkan |

### Usage Example

```
<RevisionDialog sourceDdclId="ddcl-123" sourceTitle="DDCL BCAS PROD 202611" nextVersionLabel="v2" />
```

---

## Rollback Pairing Field

| Field | Value |
|---|---|
| Component | RollbackPairingField |
| Description | Bagian dari form "Buat Step Baru" di Library untuk menetapkan pasangan rollback (US1.3) |
| Category | input |

### States

| State | Description | Trigger |
|---|---|---|
| unselected | Belum ada opsi dipilih | form baru dibuka |
| existing-selected | Memilih step rollback yang sudah ada | pilih radio "Pilih dari Library" |
| new-selected | Membuat step rollback baru sekaligus | pilih radio "Buat step rollback baru" |
| deferred-selected | Menunda pengisian pasangan rollback | pilih radio "Belum ada, lengkapi nanti" |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| mode | 'existing' \| 'new' \| 'deferred' | yes | 'deferred' | Pilihan radio yang aktif |
| existingStepId | string \| null | no | null | ID step rollback yang dipilih (jika mode='existing') |
| newStepName | string \| null | no | null | Nama step rollback baru (jika mode='new') |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| desktop (>1024px) | Tiga opsi radio berjajar vertikal di dalam modal "Buat Step Baru" |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `radiogroup` untuk ketiga opsi, dengan `aria-label` "Pasangan Rollback" |
| Keyboard interaction | Panah atas/bawah pindah antar opsi radio, Tab masuk/keluar grup |
| Label / aria-label | Setiap opsi radio punya label teks yang jelas |
| Contrast ratio | WCAG AA |
| Screen reader | Field yang nonaktif pada opsi yang tidak dipilih diberi `aria-disabled="true"` dan diumumkan sebagai nonaktif |
| Focus management | Field input yang relevan dengan opsi yang baru dipilih otomatis menerima fokus |

### Usage Example

```
<RollbackPairingField mode="new" newStepName="Restore database dari backup" />
```

---

## Export Warning Dialog

| Field | Value |
|---|---|
| Component | ExportWarningDialog |
| Description | Menampilkan peringatan/blokir sebelum ekspor Excel untuk kasus data tidak lengkap atau jumlah step tidak wajar (AC4.1.3, AC4.1.4) |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| blocking | Data belum lengkap — hanya tombol "Tutup", tidak bisa lanjut | validasi gagal (field wajib kosong / tidak ada step) |
| warning | Jumlah step di luar kebiasaan — tetap bisa lanjut | validasi lunak (step per fase > ambang wajar) |
| hidden | Tidak ada masalah, unduhan langsung berjalan | validasi lolos sepenuhnya |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| severity | 'blocking' \| 'warning' | yes | — | Menentukan apakah tombol lanjut ditampilkan |
| issues | string[] | yes | [] | Daftar masalah yang ditemukan, ditampilkan sebagai list |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| desktop (>1024px) | Dialog modal tengah layar |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA role | `alertdialog` (karena memerlukan respons pengguna) |
| Keyboard interaction | Escape menutup dialog blocking; untuk severity='warning', Escape setara klik "Batal" |
| Label / aria-label | `aria-labelledby` ke judul ("DDCL belum lengkap" / "Jumlah step di fase ini cukup banyak") |
| Contrast ratio | WCAG AA |
| Screen reader | Daftar masalah dibacakan sebagai list (`<ul>`), bukan teks gabungan |
| Focus management | Fokus ke tombol utama (Tutup / Lanjutkan Unduh) saat dialog terbuka |

### Usage Example

```
<ExportWarningDialog severity="blocking" issues={["Release Objective kosong", "Belum ada step di Deployment Checklist"]} />
```
