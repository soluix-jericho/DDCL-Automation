-- U2 Step Library. Hand-written equivalent of `prisma migrate dev --create-only`, reviewed by hand.
-- Contains raw SQL Prisma cannot express: functional unique indexes and the snapshot backfill.

-- AlterTable: Step gets timestamps (temporary default fills the rows U1 already created).
ALTER TABLE "Step" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Step" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "StepColumn" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT,

    CONSTRAINT "StepColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepLine" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "StepLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepAttachment" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "StepAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepBundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StepBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleForwardMember" (
    "bundleId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BundleForwardMember_pkey" PRIMARY KEY ("bundleId","stepId")
);

-- CreateTable
CREATE TABLE "BundleRollbackMember" (
    "bundleId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BundleRollbackMember_pkey" PRIMARY KEY ("bundleId","stepId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StepColumn_stepId_position_key" ON "StepColumn"("stepId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StepLine_columnId_position_key" ON "StepLine"("columnId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StepAttachment_stepId_filename_key" ON "StepAttachment"("stepId", "filename");

-- CreateIndex
CREATE INDEX "BundleForwardMember_stepId_idx" ON "BundleForwardMember"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleForwardMember_bundleId_position_key" ON "BundleForwardMember"("bundleId", "position");

-- CreateIndex
CREATE INDEX "BundleRollbackMember_stepId_idx" ON "BundleRollbackMember"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleRollbackMember_bundleId_position_key" ON "BundleRollbackMember"("bundleId", "position");

-- CreateIndex
CREATE INDEX "Step_pairedRollbackStepId_idx" ON "Step"("pairedRollbackStepId");

-- AddForeignKey
ALTER TABLE "StepColumn" ADD CONSTRAINT "StepColumn_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepLine" ADD CONSTRAINT "StepLine_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "StepColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepAttachment" ADD CONSTRAINT "StepAttachment_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleForwardMember" ADD CONSTRAINT "BundleForwardMember_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "StepBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleForwardMember" ADD CONSTRAINT "BundleForwardMember_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleRollbackMember" ADD CONSTRAINT "BundleRollbackMember_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "StepBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleRollbackMember" ADD CONSTRAINT "BundleRollbackMember_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChecklistItem.stepId becomes optional. The FK keeps ON DELETE RESTRICT: the delete code clears it
-- explicitly so the impact report can count the items (BR2.7).
ALTER TABLE "ChecklistItem" ALTER COLUMN "stepId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ChecklistItem_stepId_idx" ON "ChecklistItem"("stepId");

-- stepSnapshot: add nullable, backfill U1 items from their Step (BR2.8), then make it required.
-- Shape matches what the application writes: columns/attachments are empty for U1 steps.
ALTER TABLE "ChecklistItem" ADD COLUMN "stepSnapshot" JSONB;

UPDATE "ChecklistItem" c
SET "stepSnapshot" = jsonb_build_object(
    'id', s."id",
    'name', s."name",
    'category', s."category",
    'kind', s."kind"::text,
    'columns', '[]'::jsonb,
    'attachments', '[]'::jsonb,
    'pairedRollback', 'null'::jsonb
)
FROM "Step" s
WHERE s."id" = c."stepId";

ALTER TABLE "ChecklistItem" ALTER COLUMN "stepSnapshot" SET NOT NULL;

-- U1 allowed duplicate names. Give the later duplicates a " (n)" suffix so the unique index can be built.
-- (An existing name already ending in " (2)" could still collide; the index creation then fails loudly.)
UPDATE "Step" s
SET "name" = s."name" || ' (' || d.rn || ')'
FROM (
    SELECT "id", row_number() OVER (PARTITION BY lower(btrim("name")), "category", "kind" ORDER BY "id") AS rn
    FROM "Step"
) d
WHERE d."id" = s."id" AND d.rn > 1;

-- Functional unique indexes (NFR4.7, BR2.3, BR2.11). Prisma cannot model these; the CI test checks they exist.
CREATE UNIQUE INDEX "step_name_unique" ON "Step" (lower(btrim("name")), "category", "kind");
CREATE UNIQUE INDEX "bundle_name_unique" ON "StepBundle" (lower(btrim("name")));
