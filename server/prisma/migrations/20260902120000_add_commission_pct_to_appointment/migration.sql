-- Congela el % de comisión en la propia cita, igual que ya se hace en Finance.
-- Motivo: buildFinancialReport() calculaba la comisión desde el % vivo de la
-- ficha (Manicurist.commissionPercentage), así que cambiar ese % reescribía
-- retroactivamente todos los cierres pasados. Con el % congelado en la cita,
-- los cierres históricos dejan de moverse.
ALTER TABLE `Appointment` ADD COLUMN `commissionPercentage` DOUBLE NULL;

-- Tabla puente con el % histórico real de cada manicurista, deducido de los
-- registros Finance de tipo INCOME que sí lo tienen congelado. A día de hoy
-- cada manicurista tiene un único valor distinto (Flor 10, Dimarys 50), por lo
-- que MIN() devuelve ese valor. Se materializa en una tabla aparte porque MySQL
-- no permite leer de la misma tabla que se está actualizando.
DROP TABLE IF EXISTS `_pct_historico`;
CREATE TABLE `_pct_historico` AS
  SELECT `manicuristId`, MIN(`commissionPercentage`) AS `pct`
  FROM `Finance`
  WHERE `type` = 'INCOME'
    AND `manicuristId` IS NOT NULL
    AND `commissionPercentage` IS NOT NULL
  GROUP BY `manicuristId`;

-- Backfill de las citas ya completadas con su % histórico.
UPDATE `Appointment` a
INNER JOIN `_pct_historico` h ON h.`manicuristId` = a.`manicuristId`
SET a.`commissionPercentage` = h.`pct`
WHERE a.`status` = 'COMPLETED' AND a.`commissionPercentage` IS NULL;

-- Backfill de los Finance INCOME antiguos que quedaron sin % congelado
-- (anteriores a la migración 20260708000000_add_commission_pct_to_finance).
UPDATE `Finance` f
INNER JOIN `_pct_historico` h ON h.`manicuristId` = f.`manicuristId`
SET f.`commissionPercentage` = h.`pct`
WHERE f.`type` = 'INCOME'
  AND f.`manicuristId` IS NOT NULL
  AND f.`commissionPercentage` IS NULL;

DROP TABLE `_pct_historico`;
