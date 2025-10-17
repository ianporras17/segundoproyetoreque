CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.users (nombre, correo, password_hash, codigo, rol, carrera, telefono)
VALUES (
  'Ana Pérez',
  'ana.perez@estudiantec.cr',
  crypt('MiClaveSegura123', gen_salt('bf')),
  '20251234',
  'estudiante',
  'Ingeniería en Computadores',
  '8888-8888'
);
