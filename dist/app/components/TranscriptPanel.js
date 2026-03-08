import { jsx as _jsx } from "react/jsx-runtime";
export default function TranscriptPanel({ history = [] }) {
    return (_jsx("div", { className: "w-full h-64 overflow-y-auto bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col gap-3", children: history.length === 0 ? (_jsx("p", { className: "text-white/40 text-center italic mt-auto mb-auto", children: "No transcript yet. Ask a question." })) : (history.map((msg, idx) => (_jsx("div", { className: `max-w-[80%] rounded-lg p-3 ${msg.sender === 'user' ? 'bg-blue-600 self-end text-white' : 'bg-white/10 self-start text-white/90'}`, children: msg.text }, idx)))) }));
}
//# sourceMappingURL=TranscriptPanel.js.map