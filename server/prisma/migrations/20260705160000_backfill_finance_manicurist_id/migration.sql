-- Poblar manicuristId en registros Finance existentes usando el color como puente
UPDATE `Finance` f
INNER JOIN `Manicurist` m ON f.manicuristColor = m.color
SET f.manicuristId = m.id
WHERE f.manicuristId IS NULL AND f.manicuristColor IS NOT NULL;
