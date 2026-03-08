"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const agentController_1 = require("../../server/ai/agentController");
const app = (0, express_1.default)();
const controller = new agentController_1.AgentController();
const host = process.env.BACKEND_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.BACKEND_PORT ?? "4000", 10);
app.use(express_1.default.json({ limit: "4mb" }));
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "optical-express-backend",
        timestamp: new Date().toISOString(),
    });
});
app.post("/api/interact", async (req, res) => {
    const body = req.body;
    if (!body.transcribedText || typeof body.transcribedText !== "string") {
        res.status(400).json({
            status: "error",
            msg: "transcribedText is required.",
        });
        return;
    }
    const result = await controller.processInteraction(body.frameData ?? null, body.transcribedText, body.convoState ?? null);
    res.json(result);
});
app.use((_req, res) => {
    res.status(404).json({ status: "error", msg: "Not found" });
});
app.listen(port, host, () => {
    console.log(`Express backend listening on http://${host}:${port}`);
});
