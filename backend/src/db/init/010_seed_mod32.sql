-- ============================================================
-- 010_seed_mod32.sql
-- Seed para MÓDULO 3.2 — Búsqueda y Consulta de Disponibilidad
-- Crea 2 labs con equipos, horarios, bloqueos y políticas
-- Idempotente: ON CONFLICT evita duplicados si se re-ejecuta
-- ============================================================

-- 010_seed_mod32.sql — módulo 3.2 (labs, equipos, horarios, bloqueos, políticas)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Lab 1: Electrónica (Cartago)
WITH lab AS (
  INSERT INTO laboratorios (nombre, codigo_interno, ubicacion, descripcion)
  VALUES ('Lab Electrónica I', 'ELEC-101', 'Cartago', 'Laboratorio de medición y osciloscopios')
  ON CONFLICT (codigo_interno) DO UPDATE SET
    nombre=EXCLUDED.nombre, ubicacion=EXCLUDED.ubicacion, descripcion=EXCLUDED.descripcion
  RETURNING id
)
INSERT INTO equipos_fijos (laboratorio_id, codigo_inventario, nombre, estado_operativo,
                           tipo, estado_disp, cantidad_total, cantidad_disponible, reservable)
SELECT id, 'EQ-OSC-001', 'Osciloscopio Tektronix', 'operativo',
       'equipo', 'disponible', 5, 5, TRUE
FROM lab
ON CONFLICT (laboratorio_id, codigo_inventario) DO NOTHING;

WITH lab AS (SELECT id FROM laboratorios WHERE codigo_interno='ELEC-101')
INSERT INTO equipos_fijos (laboratorio_id, codigo_inventario, nombre, estado_operativo,
                           tipo, estado_disp, cantidad_total, cantidad_disponible, reservable)
SELECT id, 'EQ-MULT-001', 'Multímetro Fluke', 'operativo',
       'equipo', 'disponible', 10, 8, TRUE
FROM lab
ON CONFLICT (laboratorio_id, codigo_inventario) DO NOTHING;

WITH lab AS (SELECT id FROM laboratorios WHERE codigo_interno='ELEC-101')
INSERT INTO laboratorio_horarios (laboratorio_id, dow, hora_inicio, hora_fin, capacidad_maxima)
SELECT id, d, '08:00', '17:00', 20
FROM lab, LATERAL (VALUES (1),(2),(3),(4),(5)) AS days(d)
ON CONFLICT DO NOTHING;

WITH lab AS (SELECT id FROM laboratorios WHERE codigo_interno='ELEC-101')
INSERT INTO laboratorio_bloqueos (laboratorio_id, titulo, tipo, ts_inicio, ts_fin, descripcion)
SELECT id, 'Mantenimiento breve', 'mantenimiento',
       date_trunc('day', now()) + interval '1 day' + time '10:00',
       date_trunc('day', now()) + interval '1 day' + time '12:00',
       'Revisión periódica'
FROM lab
ON CONFLICT DO NOTHING;

WITH lab AS (SELECT id FROM laboratorios WHERE codigo_interno='ELEC-101')
INSERT INTO requisitos (laboratorio_id, nombre, descripcion, tipo, obligatorio, vigente_desde)
SELECT id, 'Uso de bata y lentes', 'EPP obligatorio', 'seguridad', TRUE, now()
FROM lab
ON CONFLICT DO NOTHING;

-- Lab 2: Mecatrónica (San José)
WITH lab AS (
  INSERT INTO laboratorios (nombre, codigo_interno, ubicacion, descripcion)
  VALUES ('Lab Mecatrónica', 'MECA-201', 'San José', 'Laboratorio de prototipado e impresión 3D')
  ON CONFLICT (codigo_interno) DO UPDATE SET
    nombre=EXCLUDED.nombre, ubicacion=EXCLUDED.ubicacion, descripcion=EXCLUDED.descripcion
  RETURNING id
)
INSERT INTO equipos_fijos (laboratorio_id, codigo_inventario, nombre, estado_operativo,
                           tipo, estado_disp, cantidad_total, cantidad_disponible, reservable)
SELECT id, 'EQ-IMP3D-001', 'Impresora 3D Prusa', 'operativo',
       'equipo', 'disponible', 3, 2, TRUE
FROM lab
ON CONFLICT (laboratorio_id, codigo_inventario) DO NOTHING;

WITH lab AS (SELECT id FROM laboratorios WHERE codigo_interno='MECA-201')
INSERT INTO laboratorio_horarios (laboratorio_id, dow, hora_inicio, hora_fin, capacidad_maxima)
SELECT id, d, '09:00', '18:00', 15
FROM lab, LATERAL (VALUES (1),(2),(3),(4),(5)) AS days(d)
ON CONFLICT DO NOTHING;

WITH lab AS (SELECT id FROM laboratorios WHERE codigo_interno='MECA-201')
INSERT INTO laboratorio_bloqueos (laboratorio_id, titulo, tipo, ts_inicio, ts_fin, descripcion)
SELECT id, 'Evento interno', 'evento',
       date_trunc('day', now()) - interval '5 day' + time '14:00',
       date_trunc('day', now()) - interval '5 day' + time '16:00',
       'Demostración'
FROM lab
ON CONFLICT DO NOTHING;
