-- Elimina el contrato provisional de lectura del Sub-modulo 04.
-- El dominio fue reclamado y entregado por el Sub-modulo 03
-- (periodos_depreciacion + detalle_depreciacion), y desde la reconciliacion
-- (commit 2240330) ningun servicio ni pantalla del sistema la consulta.
-- La tabla solo contenia 174 filas sinteticas sembradas por un seed eliminado.
DROP TABLE IF EXISTS "depreciaciones_mensual";
