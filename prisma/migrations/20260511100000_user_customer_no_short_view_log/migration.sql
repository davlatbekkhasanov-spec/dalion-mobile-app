-- AlterTable
ALTER TABLE "User" ADD COLUMN "customerNo" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "User_customerNo_key" ON "User"("customerNo");

-- CreateTable
CREATE TABLE "ShortViewLog" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "viewerPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShortViewLog_shortId_idx" ON "ShortViewLog"("shortId");

-- CreateIndex
CREATE INDEX "ShortViewLog_viewerPhone_idx" ON "ShortViewLog"("viewerPhone");

-- Backfill customer numbers for existing users (stable order by registration time)
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "User"
  WHERE "customerNo" IS NULL
)
UPDATE "User" u
SET "customerNo" = n.rn
FROM numbered n
WHERE u."id" = n."id";
