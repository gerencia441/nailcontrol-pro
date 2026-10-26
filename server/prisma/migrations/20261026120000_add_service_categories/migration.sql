-- Categorías de servicio (manicure, pedicure, cejas, pestañas) y categorías
-- asignadas a cada especialista (tabla Manicurist).
--
-- Los servicios existentes quedan en MANICURE: son todos de uñas y la
-- administradora corrige desde el panel los que sean de pedicure.
ALTER TABLE `Service`
    ADD COLUMN `category` ENUM('MANICURE', 'PEDICURE', 'EYEBROWS', 'LASHES') NOT NULL DEFAULT 'MANICURE',
    ADD COLUMN `subcategory` ENUM('NATURAL_NAIL_OVERLAY', 'ARTIFICIAL_SYSTEMS', 'MANICURE_SERVICES') NULL;

-- CreateTable
CREATE TABLE `ManicuristCategory` (
    `manicuristId` VARCHAR(191) NOT NULL,
    `category` ENUM('MANICURE', 'PEDICURE', 'EYEBROWS', 'LASHES') NOT NULL,

    PRIMARY KEY (`manicuristId`, `category`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ManicuristCategory` ADD CONSTRAINT `ManicuristCategory_manicuristId_fkey` FOREIGN KEY (`manicuristId`) REFERENCES `Manicurist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill que conserva exactamente quién presta qué:
-- * Con servicios asignados explícitamente: no recibe categorías, así sigue
--   prestando solo esa lista (y no hereda servicios de cejas/pestañas).
-- * Sin servicios asignados (antes significaba "presta todos"): recibe
--   MANICURE y PEDICURE, es decir, todos los servicios de uñas.
INSERT INTO `ManicuristCategory` (`manicuristId`, `category`)
SELECT m.`id`, c.`category`
FROM `Manicurist` m
CROSS JOIN (SELECT 'MANICURE' AS `category` UNION ALL SELECT 'PEDICURE') c
WHERE NOT EXISTS (
    SELECT 1 FROM `ManicuristService` ms WHERE ms.`manicuristId` = m.`id`
);
