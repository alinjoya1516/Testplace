-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EXECUTOR', 'READER');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('READY', 'DRAFT', 'RETIRED');

-- CreateEnum
CREATE TYPE "RequirementSource" AS ENUM ('TAG', 'FILE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('APPLIED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "directoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'READER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "priority" TEXT,
    "source" "RequirementSource" NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRevision" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "gitCommit" TEXT,
    "status" "ImportStatus" NOT NULL,
    "report" JSONB NOT NULL,

    CONSTRAINT "ImportRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "status" "TestCaseStatus" NOT NULL,
    "priority" TEXT,
    "tags" TEXT[],
    "jiraKeys" TEXT[],
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseVersion" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "revisionId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "testData" TEXT,
    "preconditions" TEXT[],
    "cleanup" TEXT,
    "notes" TEXT[],
    "openQuestions" TEXT[],
    "priority" TEXT,
    "tags" TEXT[],
    "requirementIds" TEXT[],
    "jiraKeys" TEXT[],
    "sourceFile" TEXT NOT NULL,
    "sourceLine" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RequirementToTestCase" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RequirementToTestCase_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_directoryId_key" ON "User"("directoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_currentVersionId_key" ON "TestCase"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseVersion_testCaseId_number_key" ON "TestCaseVersion"("testCaseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Step_versionId_position_key" ON "Step"("versionId", "position");

-- CreateIndex
CREATE INDEX "_RequirementToTestCase_B_index" ON "_RequirementToTestCase"("B");

-- AddForeignKey
ALTER TABLE "ImportRevision" ADD CONSTRAINT "ImportRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseVersion" ADD CONSTRAINT "TestCaseVersion_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseVersion" ADD CONSTRAINT "TestCaseVersion_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ImportRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TestCaseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequirementToTestCase" ADD CONSTRAINT "_RequirementToTestCase_A_fkey" FOREIGN KEY ("A") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequirementToTestCase" ADD CONSTRAINT "_RequirementToTestCase_B_fkey" FOREIGN KEY ("B") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
