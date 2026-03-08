import express, { type Request, type Response } from "express";
import { AgentController } from "../../server/ai/agentController";

interface InteractionPayload {
  frameData?: unknown;
  transcribedText?: string;
  convoState?: Record<string, unknown> | null;
}

const app = express();
const controller = new AgentController();
const host = process.env.BACKEND_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.BACKEND_PORT ?? "4000", 10);

app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "optical-express-backend",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/interact", async (req: Request, res: Response) => {
  const body = req.body as InteractionPayload;

  if (!body.transcribedText || typeof body.transcribedText !== "string") {
    res.status(400).json({
      status: "error",
      msg: "transcribedText is required.",
    });
    return;
  }

  const result = await controller.processInteraction(
    body.frameData ?? null,
    body.transcribedText,
    body.convoState ?? null,
  );

  res.json(result);
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: "error", msg: "Not found" });
});

app.listen(port, host, () => {
  console.log(`Express backend listening on http://${host}:${port}`);
});
