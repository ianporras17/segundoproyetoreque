-- 000_schema_core.sql — Esquema base para módulo 3.2 (y users)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL CHECK (rol IN ('estudiante','profesor','tecnico','admin')),
  carrera TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT correo_institucional_chk CHECK (
    correo ~* '@(estudiantec\.cr|itcr\.ac\.cr|tec\.ac\.cr)$'
  )
);
CREATE INDEX IF NOT EXISTS idx_users_correo ON users (correo);
CREATE INDEX IF NOT EXISTS idx_users_codigo ON users (codigo);

-- LABS
CREATE TABLE IF NOT EXISTS laboratorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  codigo_interno TEXT NOT NULL,
  ubicacion TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_labs_codigo UNIQUE (codigo_interno)
);
CREATE INDEX IF NOT EXISTS idx_labs_nombre ON laboratorios (nombre);

-- EQUIPOS
CREATE TABLE IF NOT EXISTS equipos_fijos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  codigo_inventario TEXT NOT NULL,
  nombre TEXT NOT NULL,
  estado_operativo TEXT NOT NULL CHECK (estado_operativo IN ('operativo','fuera_servicio','baja')),
  fecha_ultimo_mant TIMESTAMPTZ,
  tipo TEXT NOT NULL CHECK (tipo IN ('equipo','material','software')),
  estado_disp TEXT NOT NULL CHECK (estado_disp IN ('disponible','reservado','en_mantenimiento','inactivo')),
  cantidad_total INT NOT NULL DEFAULT 1 CHECK (cantidad_total >= 0),
  cantidad_disponible INT NOT NULL DEFAULT 1 CHECK (cantidad_disponible >= 0 AND cantidad_disponible <= cantidad_total),
  ficha_tecnica JSONB,
  fotos TEXT[],
  reservable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_equipo_por_lab UNIQUE (laboratorio_id, codigo_inventario)
);
CREATE INDEX IF NOT EXISTS idx_equipo_lab    ON equipos_fijos (laboratorio_id);
CREATE INDEX IF NOT EXISTS idx_equipo_tipo   ON equipos_fijos (tipo);
CREATE INDEX IF NOT EXISTS idx_equipo_estado ON equipos_fijos (estado_disp);

-- HORARIOS
CREATE TABLE IF NOT EXISTS laboratorio_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  dow SMALLINT NOT NULL CHECK (dow BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  capacidad_maxima INT NOT NULL CHECK (capacidad_maxima > 0),
  CONSTRAINT chk_horario_order CHECK (hora_inicio < hora_fin)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lab_dow_slot
  ON laboratorio_horarios (laboratorio_id, dow, hora_inicio, hora_fin);

-- BLOQUEOS
CREATE TABLE IF NOT EXISTS laboratorio_bloqueos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('evento','mantenimiento','uso_exclusivo','bloqueo')),
  ts_inicio TIMESTAMPTZ NOT NULL,
  ts_fin TIMESTAMPTZ NOT NULL,
  descripcion TEXT,
  creado_por UUID REFERENCES users(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bloqueo_rango CHECK (ts_inicio < ts_fin)
);
CREATE INDEX IF NOT EXISTS idx_bloq_lab_rango
  ON laboratorio_bloqueos (laboratorio_id, ts_inicio, ts_fin);

-- REQUISITOS
CREATE TABLE IF NOT EXISTS requisitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratorio_id UUID NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('academico','seguridad','otro')),
  obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde TIMESTAMPTZ,
  vigente_hasta TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_req_lab ON requisitos (laboratorio_id);
