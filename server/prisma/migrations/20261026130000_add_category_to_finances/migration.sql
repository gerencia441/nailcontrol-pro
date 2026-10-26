-- Reporte financiero por categoría de servicio.
--
-- AppointmentService.category/amount se congelan al completar cada cita. Sin
-- backfill deliberado: las citas ya completadas quedan NULL y los reportes las
-- reparten al vuelo con la categoría y el precio base actuales del servicio.
ALTER TABLE `AppointmentService`
    ADD COLUMN `category` ENUM('MANICURE', 'PEDICURE', 'EYEBROWS', 'LASHES') NULL,
    ADD COLUMN `amount` DOUBLE NULL;

-- Categoría de servicio de un registro financiero. Los existentes quedan NULL
-- (gasto general / sin imputar).
ALTER TABLE `Finance` ADD COLUMN `serviceCategory` ENUM('MANICURE', 'PEDICURE', 'EYEBROWS', 'LASHES') NULL;
