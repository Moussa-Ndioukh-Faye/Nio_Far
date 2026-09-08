-- CreateEnum
CREATE TYPE "GameCategory" AS ENUM ('CONNAISSANCE', 'ACTION_VERITE', 'FUN', 'ROMANTIC', 'PROFOND', 'FLIRT', 'COMPETITION');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('SOFT', 'NORMAL', 'INTENSE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GameType" ADD VALUE 'GUESS_MY_ANSWER';
ALTER TYPE "GameType" ADD VALUE 'WHO_KNOWS_BEST';
ALTER TYPE "GameType" ADD VALUE 'TRUTH';
ALTER TYPE "GameType" ADD VALUE 'DARE';
ALTER TYPE "GameType" ADD VALUE 'WHO_IS_MORE';
ALTER TYPE "GameType" ADD VALUE 'WOULD_YOU_RATHER';
ALTER TYPE "GameType" ADD VALUE 'NO_YES_NO';
ALTER TYPE "GameType" ADD VALUE 'MIME_PARTNER';
ALTER TYPE "GameType" ADD VALUE 'COMPLIMENT_CHALLENGE';
ALTER TYPE "GameType" ADD VALUE 'OUR_MEMORIES';
ALTER TYPE "GameType" ADD VALUE 'COMPLETE_THE_SENTENCE';
ALTER TYPE "GameType" ADD VALUE 'FIVE_THINGS';
ALTER TYPE "GameType" ADD VALUE 'DEEP_QUESTIONS';
ALTER TYPE "GameType" ADD VALUE 'OUR_DREAMS';
ALTER TYPE "GameType" ADD VALUE 'OUR_FUTURE';
ALTER TYPE "GameType" ADD VALUE 'OUR_VALUES';
ALTER TYPE "GameType" ADD VALUE 'FLIRT_QUESTIONS';
ALTER TYPE "GameType" ADD VALUE 'SEDUCTION_CHALLENGES';
ALTER TYPE "GameType" ADD VALUE 'IMPOSSIBLE_CHOICE';
ALTER TYPE "GameType" ADD VALUE 'TIMED_QUIZ';
ALTER TYPE "GameType" ADD VALUE 'SPEED_DUEL';

-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_questionId_fkey";

-- AlterTable
ALTER TABLE "Answer" DROP COLUMN "questionId";

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "category" "GameCategory" NOT NULL DEFAULT 'CONNAISSANCE',
ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'SOFT',
ADD COLUMN     "scoringEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totalRounds" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "deviceId" TEXT;

-- DropTable
DROP TABLE "Challenge";

-- DropTable
DROP TABLE "Question";

-- DropEnum
DROP TYPE "ChallengeType";

-- CreateTable
CREATE TABLE "GameCard" (
    "id" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "category" "GameCategory" NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'NORMAL',
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "options" TEXT[],
    "points" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameCard_gameType_difficulty_idx" ON "GameCard"("gameType", "difficulty");

-- CreateIndex
CREATE INDEX "GameCard_category_difficulty_idx" ON "GameCard"("category", "difficulty");

-- CreateIndex
CREATE INDEX "GameCard_isActive_idx" ON "GameCard"("isActive");

-- CreateIndex
CREATE INDEX "GameSession_category_idx" ON "GameSession"("category");

-- CreateIndex
CREATE INDEX "Player_deviceId_idx" ON "Player"("deviceId");

