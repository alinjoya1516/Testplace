-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExecutionType" AS ENUM ('MANUAL', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('NOT_RUN', 'PASSED', 'FAILED', 'BLOCKED');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "build" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "tagExpression" TEXT NOT NULL,
    "includeDrafts" BOOLEAN NOT NULL DEFAULT false,
    "plannedStart" DATE,
    "plannedEnd" DATE,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "needsReplay" BOOLEAN NOT NULL DEFAULT false,
    "launchedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "duplicatedFromId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "testCaseVersionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "ExecutionType" NOT NULL DEFAULT 'MANUAL',
    "assigneeId" TEXT,
    "status" "ResultStatus" NOT NULL DEFAULT 'NOT_RUN',
    "statusOverridden" BOOLEAN NOT NULL DEFAULT false,
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "timerStartedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepResult" (
    "id" SERIAL NOT NULL,
    "executionId" INTEGER NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'NOT_RUN',
    "comment" TEXT,
    "blockedReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StepResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionStatusChange" (
    "id" SERIAL NOT NULL,
    "executionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "fromStatus" "ResultStatus" NOT NULL,
    "toStatus" "ResultStatus" NOT NULL,
    "overridden" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Execution_assigneeId_idx" ON "Execution"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_campaignId_testCaseId_key" ON "Execution"("campaignId", "testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_campaignId_position_key" ON "Execution"("campaignId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StepResult_executionId_stepId_key" ON "StepResult"("executionId", "stepId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_duplicatedFromId_fkey" FOREIGN KEY ("duplicatedFromId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_testCaseVersionId_fkey" FOREIGN KEY ("testCaseVersionId") REFERENCES "TestCaseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepResult" ADD CONSTRAINT "StepResult_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepResult" ADD CONSTRAINT "StepResult_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionStatusChange" ADD CONSTRAINT "ExecutionStatusChange_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionStatusChange" ADD CONSTRAINT "ExecutionStatusChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
