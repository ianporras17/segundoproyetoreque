INSERT INTO department(name, code, inst_email)
VALUES ('Escuela de Ing. en Computación','EIC','eic@itcr.ac.cr')
ON CONFLICT (code) DO NOTHING;

INSERT INTO lab(department_id, name, internal_code, location, description)
VALUES (1, 'Laboratorio de Bases de Datos', 'LAB-DB-01', 'Edificio A, piso 2', 'Área de prácticas de BD')
ON CONFLICT (internal_code) DO NOTHING;

INSERT INTO lab_contact(lab_id, full_name, role_title, phone, email, is_primary)
VALUES (1, 'María Pérez', 'Encargada', '2550-0000', 'maria.perez@itcr.ac.cr', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO lab_equipment(lab_id, inventory_code, name, status, last_maintenance)
VALUES (1, 'EQ-DB-001', 'Servidor PostgreSQL', 'disponible', '2025-09-20')
ON CONFLICT DO NOTHING;

INSERT INTO lab_material(lab_id, name, unit, initial_stock, reorder_point, current_stock)
VALUES (1, 'Cables RJ45', 'unidades', 100, 20, 100)
ON CONFLICT DO NOTHING;

INSERT INTO lab_policy(lab_id, requirements, schedule, capacity)
VALUES (1, 'Curso previo BD1; Inducción de seguridad', 'L–V 8:00–17:00', 24)
ON CONFLICT DO NOTHING;

INSERT INTO lab_history(lab_id, user_email, action, meta)
VALUES (1, 'admin@itcr.ac.cr', 'perfil_creado', '{"source":"seed"}');
