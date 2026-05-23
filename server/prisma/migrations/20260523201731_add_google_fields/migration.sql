-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `googleEventId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `googleRefreshToken` VARCHAR(191) NULL;
