-- CreateEnum
CREATE TYPE "StepKind" AS ENUM ('forward', 'rollback');

-- CreateEnum
CREATE TYPE "DdclStatus" AS ENUM ('Draft', 'Sudah Dikirim');

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" "StepKind" NOT NULL DEFAULT 'forward',
    "pairedRollbackStepId" TEXT,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DdclDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DdclStatus" NOT NULL DEFAULT 'Draft',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DdclDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseHeader" (
    "id" TEXT NOT NULL,
    "ddclId" TEXT NOT NULL,
    "date" DATE,
    "startDate" DATE,
    "impactedSystem" TEXT,
    "environment" TEXT,
    "phaseRelease" TEXT,
    "releaseObjective" TEXT,
    "technicalChange" TEXT,

    CONSTRAINT "ReleaseHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "ddclId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "parameterValues" JSONB,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseHeader_ddclId_key" ON "ReleaseHeader"("ddclId");

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_pairedRollbackStepId_fkey" FOREIGN KEY ("pairedRollbackStepId") REFERENCES "Step"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseHeader" ADD CONSTRAINT "ReleaseHeader_ddclId_fkey" FOREIGN KEY ("ddclId") REFERENCES "DdclDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_ddclId_fkey" FOREIGN KEY ("ddclId") REFERENCES "DdclDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
