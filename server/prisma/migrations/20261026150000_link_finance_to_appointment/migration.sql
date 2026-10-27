-- Enlaza cada ingreso con la cita que lo generó (permite corregir la forma de
-- pago y los pagos divididos) y registra los cambios de forma de pago.

-- AlterTable
ALTER TABLE `Finance` ADD COLUMN `appointmentId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AppointmentPaymentLog` (
    `id` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `changedByUserId` VARCHAR(191) NULL,
    `changedByName` VARCHAR(191) NOT NULL,
    `previous` TEXT NOT NULL,
    `next` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AppointmentPaymentLog_appointmentId_idx`(`appointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Finance_appointmentId_idx` ON `Finance`(`appointmentId`);

-- AddForeignKey
ALTER TABLE `Finance` ADD CONSTRAINT `Finance_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppointmentPaymentLog` ADD CONSTRAINT `AppointmentPaymentLog_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: el ingreso que crea "completar cita" lleva la misma especialista,
-- la misma fecha (la de la cita) y el mismo monto (finalPricePaid). Solo se
-- enlazan las parejas únicas en ambos sentidos; cualquier ambigüedad (p. ej.
-- ingresos reconstruidos a mano) queda sin enlazar y se corrige desde Finanzas.
-- Se usa una tabla auxiliar en vez de subconsultas sobre la tabla que se
-- actualiza (error 1093 en MySQL) o funciones de ventana (no en MySQL 5.7).
CREATE TABLE `_FinanceAppointmentCandidate` (
    `financeId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `_FinanceAppointmentCandidate` (`financeId`, `appointmentId`)
SELECT f.`id`, a.`id`
FROM `Finance` f
JOIN `Appointment` a
  ON a.`status` = 'COMPLETED'
 AND a.`manicuristId` = f.`manicuristId`
 AND a.`date` = f.`date`
 AND a.`finalPricePaid` = f.`amount`
WHERE f.`type` = 'INCOME' AND f.`isCommission` = 0;

UPDATE `Finance` f
JOIN `_FinanceAppointmentCandidate` c ON c.`financeId` = f.`id`
SET f.`appointmentId` = c.`appointmentId`
WHERE c.`financeId` IN (
        SELECT x.`financeId` FROM (
          SELECT `financeId` FROM `_FinanceAppointmentCandidate` GROUP BY `financeId` HAVING COUNT(*) = 1
        ) x
      )
  AND c.`appointmentId` IN (
        SELECT y.`appointmentId` FROM (
          SELECT `appointmentId` FROM `_FinanceAppointmentCandidate` GROUP BY `appointmentId` HAVING COUNT(*) = 1
        ) y
      );

DROP TABLE `_FinanceAppointmentCandidate`;
