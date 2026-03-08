/**
 * Component: TranscriptPanel
 * 
 * Description:
 *   Displays the conversation history between the user and the AI agent in real-time.
 *   Renders user questions and AI responses/explanations.
 * 
 * Props:
 *   - history (Array): List of message objects { sender: 'user' | 'agent', text: string }.
 */

import { useEffect, useRef } from "react";

export interface TranscriptMessage {
  id?: string;
  sender: "user" | "agent";
  text: string;
  createdAt?: string;
}

interface TranscriptPanelProps {
  history?: TranscriptMessage[];
}

export default function TranscriptPanel({ history = [] }: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [history]);

  return (
    <div
      ref={containerRef}
      className="flex h-72 w-full flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md"
    >
      {history.length === 0 ? (
        <p className="m-auto text-center italic text-white/40">No transcript yet. Ask a question.</p>
      ) : (
        history.map((msg, idx) => {
          const timestamp = msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;

          return (
            <article
              key={msg.id ?? `${msg.sender}-${idx}`}
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.sender === "user"
                  ? "self-end bg-blue-600 text-white"
                  : "self-start bg-white/10 text-white/90"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/60">
                <span>{msg.sender}</span>
                {timestamp ? <span>{timestamp}</span> : null}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
