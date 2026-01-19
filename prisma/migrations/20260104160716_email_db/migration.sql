/*
  Warnings:

  - You are about to drop the `Employee` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[nameValueId]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Group` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_clientId_fkey";

-- DropIndex
DROP INDEX "Contact_createdById_idx";

-- DropIndex
DROP INDEX "Contact_nameValueId_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "createdById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "createdById" TEXT NOT NULL;

-- DropTable
DROP TABLE "Employee";

-- CreateIndex
CREATE UNIQUE INDEX "Contact_nameValueId_key" ON "Contact"("nameValueId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_nameValueId_fkey" FOREIGN KEY ("nameValueId") REFERENCES "ContactCustomFieldValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
