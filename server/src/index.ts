import express from "express";
import cors from "cors";
import { router } from "./routes.js";

const app = express();
const port = Number(process.env.PORT ?? 5000);
const clientOrigin = process.env.CLIENT_ORIGIN;

app.use(
  cors(
    clientOrigin
      ? { origin: [clientOrigin, /\.replit\.dev$/, /\.replit\.app$/] }
      : { origin: true }
  )
);
app.use(express.json());

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`[server] MLB Parleys Pick API listening on http://0.0.0.0:${port}`);
  console.log(`[server] Mock mode: ${process.env.MOCK_MODE !== "false" ? "ON" : "OFF"}`);
});
