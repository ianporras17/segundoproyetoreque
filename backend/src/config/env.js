export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3000", 10),
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  JWT_SECRET: process.env.JWT_SECRET ?? "change_me",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m"
};
