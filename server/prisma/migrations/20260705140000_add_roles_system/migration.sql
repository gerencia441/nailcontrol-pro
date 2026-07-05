-- AlterTable User: add role and manicuristId
ALTER TABLE `User` ADD COLUMN `role` ENUM('ADMIN', 'MANICURIST') NOT NULL DEFAULT 'MANICURIST';
ALTER TABLE `User` ADD COLUMN `manicuristId` VARCHAR(191) NULL;
ALTER TABLE `User` ADD UNIQUE INDEX `User_manicuristId_key` (`manicuristId`);

-- El usuario existente es el administrador
UPDATE `User` SET `role` = 'ADMIN';

-- AlterTable Finance: add manicuristId for per-manicurist filtering
ALTER TABLE `Finance` ADD COLUMN `manicuristId` VARCHAR(191) NULL;
