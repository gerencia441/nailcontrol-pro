-- Clasificación operativa de egresos (insumos / gastos fijos / otro), para
-- que el cierre pueda comparar lo realmente gastado contra las reservas de
-- fundDistribution (fondoInsumos, cajaEstudio).
-- Sin backfill deliberado: los egresos existentes quedan NULL (sin
-- categorizar) y se muestran así en el reporte, en vez de asignarles una
-- categoría que nadie confirmó.
ALTER TABLE `Finance` ADD COLUMN `expenseCategory` ENUM('SUPPLIES', 'FIXED', 'OTHER') NULL;
