import "dotenv/config";
import cors from "cors";
import express from "express";
import apiRouter from "./routes/api.js";

export const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "blindcode-server" });
});

app.use("/api", apiRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled server error", error);
  response.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, () => {
  console.log(`BlindCode API listening on http://localhost:${port}`);
});