<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-11-19T00:00:00Z — Collaborators off untuk run ini, jadi lead bekerja sendiri (Step 3 dilewati seluruhnya per stage-protocol-ensemble §5); draft team-practices.md ditulis solo tanpa review quality/developer/devsecops.
- 2026-11-19T00:00:00Z — Testing Posture methodology diisi `test-after` (default org.md, belum diafirmasi manusia) karena domain MVP ini relatif CRUD + generate-Excel, bukan logika kompleks; ditandai sebagai open question untuk wawancara, bukan keputusan final.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-11-19T00:00:00Z — Tidak menambah aturan baru ke discovered-rules.md untuk "dua app terpisah dalam satu monorepo" karena itu sudah tercatat sebagai koreksi di project.md, bukan temuan baru stage ini; discovered-rules.md draft ini sengaja `None.` di kedua heading.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-11-19T00:00:00Z — Deployment draft tetap mengikuti default org.md (deploy on merge ke staging, manual approval ke production) meski feasibility-assessment.md hanya menyebut "lokal via Docker" untuk v1; menandai sebagai open question alih-alih menghapus bagian staging/production, supaya wawancara yang memutuskan menyederhanakannya atau tidak.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-11-19T00:00:00Z — Walking Skeleton: skeleton on/off bergantung pada field scope `mvp` yang terkompilasi, yang tidak dibaca langsung di draft ini; perlu dikonfirmasi saat integrasi/wawancara.
- 2026-11-19T00:00:00Z — Way of Working: belum jelas apakah backend dan frontend dalam monorepo yang sama memakai skema penamaan branch yang sama atau terpisah.
- 2026-11-19T00:00:00Z — Deployment: apakah ada lingkungan staging nyata untuk v1, atau cukup lokal via Docker sampai arah hosting ditentukan.
- 2026-11-19T00:00:00Z — **RESOLVED** (Step 5 integration): wawancara manusia (Step 4) menjawab seluruh lima area; tidak ada open question tersisa untuk stage ini. Lihat `evidence.md` ## Keputusan wawancara.

## Interpretations (integrasi Step 5)
- 2026-11-19T00:00:00Z — Lead integration pass: keempat artefak (`team-practices.md`, `discovered-rules.md`, `evidence.md`, `practices-discovery-timestamp.md`) difinalisasi dari jawaban wawancara Q1-Q5. Tidak ada file kontribusi collaborator untuk digabung (collaborators off, lihat entri Interpretations sebelumnya).
- 2026-11-19T00:00:00Z — **Interpretasi**: Q1 (jawaban B) memperkenalkan nuansa penamaan branch per-app (`feature/backend-...` vs `feature/frontend-...`) tetapi ini murni konvensi penamaan branch kerja, bukan integration branch yang berbeda. `## Way of Working` tetap mencantumkan `- **Integration branch**: main` persis sesuai kontrak stage (satu nilai branch saja pada baris itu); nuansa per-app ditulis sebagai prosa tambahan di bawahnya, bukan menggantikan nilai pada baris Integration branch.
- 2026-11-19T00:00:00Z — Testing Posture Methodology dikunci `test-after` (bukan `custom`) karena jawaban Q3 adalah A (test-after murni untuk semua bagian), bukan opsi campuran B. `discovered-rules.md` dikonfirmasi ulang tetap `None.`/`None.` karena kelima jawaban wawancara adalah preferensi praktik, bukan batasan keras baru.
