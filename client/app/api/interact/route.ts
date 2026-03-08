import { NextResponse } from "next/server";
import { AgentController } from "../../../../server/core/ai/agentController";

export const runtime = "nodejs";

interface InteractionPayload {
  frameData?: unknown;
  transcribedText?: string;
  convoState?: Record<string, unknown> | null;
}

const controller = new AgentController();

export async function POST(req: Request) {
  let body: InteractionPayload;

  try {
    body = (await req.json()) as InteractionPayload;
  } catch {
    return NextResponse.json(
      { status: "error", msg: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!body.transcribedText || typeof body.transcribedText !== "string") {
    return NextResponse.json(
      { status: "error", msg: "transcribedText is required." },
      { status: 400 },
    );
  }

  try {
    const result = await controller.processInteraction(
      body.frameData ?? null,
      body.transcribedText,
      body.convoState ?? null,
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { status: "error", msg: "Failed to process interaction." },
      { status: 500 },
    );
  }
}
