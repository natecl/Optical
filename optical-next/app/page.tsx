"use client";

import { startTransition, useEffect, useState } from "react";
import CameraView from "../components/CameraView";
import MicrophoneInput from "../components/MicrophoneInput";
import ModeToggle from "../components/ModeToggle";
import OverlayLabels from "../components/OverlayLabels";
import TranscriptPanel from "../components/TranscriptPanel";

type Mode = "standard" | "learning";

export default function Home() {
  const [mode, setMode] = useState<Mode>("standard");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [history, setHistory] = useState([
    { sender: "user" as const, text: "What am I looking at?" },
    { sender: "agent" as const, text: "I see a mechanical assembly with visible moving parts." },
  ]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        setApiStatus(response.ok ? "online" : "offline");
      } catch {
        setApiStatus("offline");
      }
    };

    void checkHealth();
  }, []);

  const askDemoQuestion = async () => {
    const question = "Explain what this object does.";

    startTransition(() => {
      setHistory((prev) => [...prev, { sender: "user", text: question }]);
    });

    try {
      const response = await fetch("/api/interact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          frameData: null,
          transcribedText: question,
          convoState: { mode },
        }),
      });

      const data = (await response.json()) as { msg?: string; status?: string };
      const message = data.msg ?? "No response from API.";

      startTransition(() => {
        setHistory((prev) => [...prev, { sender: "agent", text: message }]);
      });
    } catch {
      startTransition(() => {
        setHistory((prev) => [...prev, { sender: "agent", text: "Interaction request failed." }]);
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
          <h1 className="text-4xl font-semibold tracking-tight">Optical</h1>
          <p className="max-w-3xl text-white/70">
            Real-time multimodal AI assistant for understanding objects and systems.
          </p>
          <p className="text-sm text-white/60">
            API status: <span className={apiStatus === "online" ? "text-emerald-400" : "text-rose-400"}>{apiStatus}</span>
          </p>
          <ModeToggle currentMode={mode} onModeChange={(nextMode) => setMode(nextMode as Mode)} />
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-white/10 lg:col-span-2">
            <CameraView isActive={true} />
            <OverlayLabels
              objects={[
                { x: 12, y: 16, width: 34, height: 26, label: "Detected Object" },
                { x: 54, y: 44, width: 28, height: 32, label: "Component" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-4">
            <TranscriptPanel history={history} />
            <button
              type="button"
              onClick={() => void askDemoQuestion()}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              Ask Demo Question
            </button>
            <div className="flex justify-center py-2">
              <MicrophoneInput />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
