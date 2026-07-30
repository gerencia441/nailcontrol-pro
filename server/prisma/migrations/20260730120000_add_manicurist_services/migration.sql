-- CreateTable
CREATE TABLE `ManicuristService` (
    `manicuristId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,

    INDEX `ManicuristService_serviceId_fkey`(`serviceId`),
    PRIMARY KEY (`manicuristId`, `serviceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ManicuristService` ADD CONSTRAINT `ManicuristService_manicuristId_fkey` FOREIGN KEY (`manicuristId`) REFERENCES `Manicurist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManicuristService` ADD CONSTRAINT `ManicuristService_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
