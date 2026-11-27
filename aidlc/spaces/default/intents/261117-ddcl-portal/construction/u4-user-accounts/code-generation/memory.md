<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-11-27T00:00:00Z — rute U3 (lock, submit, versions, capture-notes, DELETE /ddcls) belum ada di kode; peta NFR2.27 dipakai sebagai acuan dan rute tak terdaftar bernilai admin, sehingga U3 tinggal mendeklarasikan role-nya.
- 2026-11-27T00:00:00Z — `createdBy` stub dihapus dan field respons `createdBy` diturunkan dari nama pembuat agar bentuk respons DDCL tidak berubah untuk ComposeScreen.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
