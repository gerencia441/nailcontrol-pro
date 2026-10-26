-- Bitácora de notas de la clienta (alergias, preferencias, servicio, general).

-- CreateTable
CREATE TABLE `ClientNote` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `type` ENUM('ALLERGY', 'PREFERENCE', 'SERVICE', 'GENERAL') NOT NULL DEFAULT 'GENERAL',
    `text` TEXT NOT NULL,
    `authorUserId` VARCHAR(191) NULL,
    `authorName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClientNote_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClientNote` ADD CONSTRAINT `ClientNote_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Las "Notas técnicas" existentes pasan a ser la primera nota de cada clienta
-- (tipo General, sin autora: solo la administradora puede editarlas).
-- Client.technicalNotes NO se borra: queda como respaldo.
INSERT INTO `ClientNote` (`id`, `clientId`, `type`, `text`, `authorUserId`, `authorName`, `createdAt`, `updatedAt`)
SELECT CONCAT('mig_', c.`id`), c.`id`, 'GENERAL', TRIM(c.`technicalNotes`), NULL,
       'Notas técnicas (registro anterior)', c.`updatedAt`, c.`updatedAt`
FROM `Client` c
WHERE c.`technicalNotes` IS NOT NULL AND TRIM(c.`technicalNotes`) <> '';
