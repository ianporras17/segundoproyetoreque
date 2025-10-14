-- 001_schema_labs.sql  (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Departamentos/Escuelas
CREATE TABLE department (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT UNIQUE,
  inst_email    TEXT UNIQUE,
  CONSTRAINT chk_dept_email_institucional
    CHECK (inst_email IS NULL OR inst_email ~* '^[A-Za-z0-9._%+-]+@((tec|itcr)\.ac\.cr|estudiantec\.cr)$')
);

-- 2) Laboratorios (perfil institucional + vínculo a departamento)
CREATE TABLE lab (
  id            SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES department(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  internal_code TEXT NOT NULL UNIQUE,
  location      TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Responsables / Contactos
CREATE TABLE lab_contact (
  id            SERIAL PRIMARY KEY,
  lab_id        INTEGER NOT NULL REFERENCES lab(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  role_title    TEXT NOT NULL,    -- encargado, técnico, etc.
  phone         TEXT,
  email         TEXT NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_contact_email_institucional
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@((tec|itcr)\.ac\.cr|estudiantec\.cr)$'),
  CONSTRAINT uq_lab_contact UNIQUE (lab_id, email)
);
-- Sólo un contacto principal por laboratorio
CREATE UNIQUE INDEX uq_lab_primary_contact
  ON lab_contact(lab_id) WHERE is_primary = TRUE;

-- 4) Equipos (recursos fijos)
CREATE TYPE equipment_status AS ENUM ('disponible','reservado','en_mantenimiento','inactivo');

CREATE TABLE lab_equipment (
  id                 SERIAL PRIMARY KEY,
  lab_id             INTEGER NOT NULL REFERENCES lab(id) ON DELETE CASCADE,
  inventory_code     TEXT NOT NULL,
  name               TEXT NOT NULL,
  status             equipment_status NOT NULL DEFAULT 'disponible',
  last_maintenance   DATE,
  UNIQUE (lab_id, inventory_code)
);

-- 5) Materiales (consumibles)
CREATE TABLE lab_material (
  id             SERIAL PRIMARY KEY,
  lab_id         INTEGER NOT NULL REFERENCES lab(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL,               -- p.ej. ml, g, unidades
  initial_stock  NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_point  NUMERIC(12,3) NOT NULL DEFAULT 0,
  current_stock  NUMERIC(12,3) NOT NULL DEFAULT 0,
  UNIQUE (lab_id, name)
);

-- 6) Políticas internas del laboratorio
CREATE TABLE lab_policy (
  id           SERIAL PRIMARY KEY,
  lab_id       INTEGER NOT NULL REFERENCES lab(id) ON DELETE CASCADE,
  requirements TEXT,        -- requisitos académicos/seguridad
  schedule     TEXT,        -- horarios de funcionamiento
  capacity     INTEGER      -- capacidad máxima
);

-- 7) Historial / Bitácora del laboratorio
CREATE TABLE lab_history (
  id         BIGSERIAL PRIMARY KEY,
  lab_id     INTEGER NOT NULL REFERENCES lab(id) ON DELETE CASCADE,
  user_email TEXT,                  -- quién ejecutó la acción (si aplica)
  action     TEXT NOT NULL,         -- 'perfil_creado', 'equipo_registrado', etc.
  meta       JSONB,                 -- payload adicional
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_history_lab ON lab_history(lab_id);
CREATE INDEX idx_lab_history_created ON lab_history(created_at);
