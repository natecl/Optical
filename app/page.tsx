"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import CameraView from "../components/CameraView";
import MicrophoneInput from "../components/MicrophoneInput";
import ModeToggle from "../components/ModeToggle";
import OverlayLabels from "../components/OverlayLabels";
import TranscriptPanel from "../components/TranscriptPanel";
import type { TranscriptMessage } from "../components/TranscriptPanel";
import BasicChatbot from "../components/basicchatbot";

type Mode = "standard" | "learning";
type WsStatus = "connecting" | "online" | "offline";

interface WsMessage {
  type: string;
  payload?: { msg?: string; status?: string };
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("standard");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [history, setHistory] = useState<TranscriptMessage[]>([
    { id: "seed-user", sender: "user", text: "What am I looking at?", createdAt: new Date().toISOString() },
    {
      id: "seed-agent",
      sender: "agent",
      text: "I see a mechanical assembly with visible moving parts.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const socketRef = useRef<WebSocket | null>(null);

  const resolveWsUrl = () => {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    return `${protocol}//${host}:8080/ws`;
  };

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

  useEffect(() => {
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      setWsStatus("connecting");

      const socket = new WebSocket(resolveWsUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        if (unmounted) return;
        setWsStatus("online");
      };

      socket.onmessage = (event: MessageEvent) => {
        let message: WsMessage;
        try {
          message = JSON.parse(event.data as string) as WsMessage;
        } catch {
          return;
        }

        if (message.type === "interaction_result") {
          const text = message.payload?.msg ?? "No response message.";
          startTransition(() => {
            setHistory((prev) => [
              ...prev,
              { id: crypto.randomUUID(), sender: "agent", text, createdAt: new Date().toISOString() },
            ]);
          });
        }

        if (message.type === "error") {
          const text = message.payload?.msg ?? "WebSocket error message received.";
          startTransition(() => {
            setHistory((prev) => [
              ...prev,
              { id: crypto.randomUUID(), sender: "agent", text, createdAt: new Date().toISOString() },
            ]);
          });
        }
      };

      socket.onclose = () => {
        if (unmounted) return;
        setWsStatus("offline");
        reconnectTimer = setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        if (unmounted) return;
        setWsStatus("offline");
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const askDemoQuestion = async () => {
    const question = "Explain what this object does.";

    startTransition(() => {
      setHistory((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: "user", text: question, createdAt: new Date().toISOString() },
      ]);
    });

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      startTransition(() => {
        setHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: "agent",
            text: "WebSocket is not connected.",
            createdAt: new Date().toISOString(),
          },
        ]);
      });
      return;
    }

    socket.send(
      JSON.stringify({
        type: "interact",
        payload: {
          frameData: null,
          transcribedText: question,
          convoState: { mode },
        },
      }),
    );
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
          <p className="text-sm text-white/60">
            WS status: <span className={wsStatus === "online" ? "text-emerald-400" : wsStatus === "connecting" ? "text-amber-300" : "text-rose-400"}>{wsStatus}</span>
          </p>
          <ModeToggle currentMode={mode} onModeChange={(nextMode) => setMode(nextMode as Mode)} />
        </header>

        <section className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/70">Camera Panel</h2>
              <div className="relative h-[420px] overflow-hidden rounded-xl border border-white/10">
                <CameraView isActive={true} />
                <OverlayLabels
                  objects={[
                    { x: 12, y: 16, width: 34, height: 26, label: "Detected Object" },
                    { x: 54, y: 44, width: 28, height: 32, label: "Component" },
                  ]}
                />
              </div>
            </article>
          </div>

          <div className="xl:col-span-5">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
              <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/70">Audio Panel</h2>
                <div className="flex flex-col items-center gap-3 py-2">
                  <MicrophoneInput />
                  <button
                    type="button"
                    onClick={() => void askDemoQuestion()}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
                  >
                    Ask Demo Question
                  </button>
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/70">Transcript Panel</h2>
                <TranscriptPanel history={history} />
              </article>

              <BasicChatbot />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
