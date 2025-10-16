import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";
import { router as apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";
import "./db/index.js"; 

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

app.use("/api/", apiRouter);
app.use(errorHandler);

export default app;
