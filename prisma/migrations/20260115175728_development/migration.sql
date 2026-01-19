/*
  Warnings:

  - You are about to drop the column `mailgunMessageIds` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `mailgunTags` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `recurringDayOfMonth` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `recurringDaysOfWeek` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `recurringEndDate` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `recurringFrequency` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `recurringStartDate` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `recurringTime` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `recurringTimezone` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the `CampaignAnalytics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuppressionList` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CampaignAnalytics" DROP CONSTRAINT "CampaignAnalytics_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_adminId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "SuppressionList" DROP CONSTRAINT "SuppressionList_clientId_fkey";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "mailgunMessageIds",
DROP COLUMN "mailgunTags",
DROP COLUMN "recurringDayOfMonth",
DROP COLUMN "recurringDaysOfWeek",
DROP COLUMN "recurringEndDate",
DROP COLUMN "recurringFrequency",
DROP COLUMN "recurringStartDate",
DROP COLUMN "recurringTime",
DROP COLUMN "recurringTimezone",
DROP COLUMN "sentAt";

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "subject";

-- DropTable
DROP TABLE "CampaignAnalytics";

-- DropTable
DROP TABLE "RefreshToken";

-- DropTable
DROP TABLE "SuppressionList";

-- DropEnum
DROP TYPE "RecurringFrequency";

-- DropEnum
DROP TYPE "SuppressionType";
