import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mlbRouter } from "./routes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 5000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, "../../client/dist");

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());
app.use("/api/mlb", mlbRouter);
app.get("/health", (_req, res) => res.json({ ok: true, service: "MLB Parleys Pick API" }));
app.use(express.static(clientDistPath));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(port, () => {
  console.log(`MLB Parleys Pick API listening on http://localhost:${port}`);
});
