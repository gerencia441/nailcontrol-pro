-- CreateTable
CREATE TABLE `AppointmentService` (
    `appointmentId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`appointmentId`, `serviceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Copy existing single-service appointments into the new join table
INSERT INTO `AppointmentService` (`appointmentId`, `serviceId`)
SELECT `id`, `serviceId`
FROM `Appointment`
WHERE `serviceId` IS NOT NULL;

-- DropForeignKey
ALTER TABLE `Appointment` DROP FOREIGN KEY `Appointment_serviceId_fkey`;

-- DropColumn
ALTER TABLE `Appointment` DROP COLUMN `serviceId`;

-- AddForeignKey
ALTER TABLE `AppointmentService` ADD CONSTRAINT `AppointmentService_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppointmentService` ADD CONSTRAINT `AppointmentService_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
