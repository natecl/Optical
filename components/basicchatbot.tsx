"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface WsMessage {
  type: string;
  payload?: { msg?: string; status?: string };
}

const resolveWsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8080/ws`;
};

export default function BasicChatbot() {
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Chatbot ready. Send a message to test websocket + backend + Gemini.",
    },
  ]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let closedByUnmount = false;

    const connect = () => {
      setStatus("connecting");
      const socket = new WebSocket(resolveWsUrl());
      socketRef.current = socket;

      socket.onopen = () => setStatus("online");

      socket.onmessage = (event) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data as string) as WsMessage;
        } catch {
          return;
        }

        if (msg.type === "chat_result") {
          const text = msg.payload?.msg ?? "No chatbot response.";
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text }]);
          return;
        }

        if (msg.type === "error") {
          const text = msg.payload?.msg ?? "WebSocket error received.";
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text }]);
        }
      };

      socket.onerror = () => setStatus("offline");
      socket.onclose = () => {
        setStatus("offline");
        if (!closedByUnmount) {
          reconnectTimerRef.current = setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closedByUnmount = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const sendMessage = () => {
    const prompt = input.trim();
    if (!prompt) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: prompt }]);
    setInput("");

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: "WebSocket is not connected." },
      ]);
      return;
    }

    const history = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      text: m.text,
    }));

    socket.send(
      JSON.stringify({
        type: "chat",
        payload: { prompt, history },
      }),
    );
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-white/70">Basic Chatbot</h2>
        <span
          className={`text-xs ${
            status === "online"
              ? "text-emerald-400"
              : status === "connecting"
                ? "text-amber-300"
                : "text-rose-400"
          }`}
        >
          {status}
        </span>
      </div>

      <div ref={listRef} className="mb-3 h-60 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "mr-auto bg-white/10 text-white/90"
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask a question..."
          className="flex-1 rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
        />
        <button
          type="button"
          onClick={sendMessage}
          className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
        >
          Send
        </button>
      </div>
    </article>
  );
}
