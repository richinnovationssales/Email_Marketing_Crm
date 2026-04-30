-- CreateTable
CREATE TABLE "Greeting" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Greeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Greeting_isActive_idx" ON "Greeting"("isActive");

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "greetingId" TEXT,
ADD COLUMN "greetingSnapshot" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_greetingId_fkey" FOREIGN KEY ("greetingId") REFERENCES "Greeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
