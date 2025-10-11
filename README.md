# Segundoproyectodereque – Backend + Docker + Postgres

API en **Node.js + Express** con **PostgreSQL** en Docker. Incluye healthcheck y estructura modular para crecer.

## Requisitos
- Docker Desktop (o Docker + Docker Compose).
- (Opcional) Node 20+ si quieres correr el backend fuera de Docker.

## Variables de entorno

### `.env` en la raíz (lo usa docker-compose)
```env
API_PORT=3000
PG_PORT=5432
PGADMIN_PORT=5050

POSTGRES_USER=appuser
POSTGRES_PASSWORD=apppass
POSTGRES_DB=appdb

PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin123

CORS_ORIGIN=http://localhost:5173



### `backend/.env` 
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://appuser:apppass@db:5432/appdb
CORS_ORIGIN=http://localhost:5173



=======================================

Levantar todo
docker compose up -d   

docker compose logs -f api           # ver logs en vivo del API esto sirve para porqué algo se jodió o así


=====================
Bajar el docker

docker compose down                  # bajar contenedores y red (mantiene volúmenes)
docker compose down -v               # bajar y ELIMINAR volúmenes (borra la BD)

docker compose down --rmi all -v --remove-orphans 

docker system prune -af --volumes 




======================================
Orden de las carpetas



backend/
├─ Dockerfile                 # imagen del API para dev
├─ .env                       # variables del backend (PORT, DATABASE_URL, etc.)
├─ .dockerignore
├─ package.json
├─ src/
│  ├─ server.js              # arranque del servidor (listen, shutdown)
│  ├─ app.js                 # configuración de Express (CORS, JSON, rutas, errores)
│  ├─ config/
│  │  └─ env.js              # lectura de variables de entorno
│  ├─ db/
│  │  ├─ index.js            # Pool de Postgres (pg) y test de conexión
│  │  └─ init/               # *.sql auto-init de la BD (solo 1ª vez)
│  │     └─ 001_schema.sql
│  ├─ middleware/
│  │  └─ error.js            # manejador central de errores
│  ├─ routes/
│  │  └─ index.js            # /api/v1/health y montaje de subrutas
│  └─ modules/
│     └─ auth/
│        ├─ auth.controller.js
│        ├─ auth.model.js
│        └─ auth.routes.js
docker-compose.yml            # orquesta db, api (y pgadmin opcional)
.env                          # variables globales para docker-compose
README.md