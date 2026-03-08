import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from 'react-dom/server';
export function renderAppDocument({ host, port }) {
    const app = (_jsxs("html", { lang: "en", children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), _jsx("title", { children: "Optical" }), _jsx("style", { children: `
                    :root {
                        color-scheme: dark;
                        --bg: #08111f;
                        --panel: rgba(8, 17, 31, 0.82);
                        --border: rgba(148, 163, 184, 0.2);
                        --text: #e2e8f0;
                        --muted: #94a3b8;
                        --accent: #22c55e;
                    }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                        background:
                            radial-gradient(circle at top, rgba(34, 197, 94, 0.18), transparent 30%),
                            linear-gradient(180deg, #08111f 0%, #020617 100%);
                        color: var(--text);
                    }
                    main {
                        min-height: 100vh;
                        display: grid;
                        place-items: center;
                        padding: 32px 20px;
                    }
                    .shell {
                        width: min(920px, 100%);
                        background: var(--panel);
                        border: 1px solid var(--border);
                        border-radius: 24px;
                        padding: 32px;
                        backdrop-filter: blur(18px);
                        box-shadow: 0 24px 80px rgba(2, 6, 23, 0.55);
                    }
                    h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3.5rem); }
                    p { line-height: 1.6; color: var(--muted); }
                    .grid {
                        display: grid;
                        gap: 16px;
                        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                        margin-top: 28px;
                    }
                    .card {
                        border: 1px solid var(--border);
                        border-radius: 18px;
                        padding: 18px;
                        background: rgba(15, 23, 42, 0.6);
                    }
                    .label {
                        display: inline-block;
                        padding: 6px 10px;
                        border-radius: 999px;
                        background: rgba(34, 197, 94, 0.14);
                        color: #bbf7d0;
                        font-size: 0.875rem;
                        margin-bottom: 12px;
                    }
                    code {
                        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                        color: #f8fafc;
                    }
                    #status {
                        color: var(--accent);
                        font-weight: 600;
                    }
                ` })] }), _jsxs("body", { children: [_jsx("main", { children: _jsxs("section", { className: "shell", children: [_jsx("div", { className: "label", children: "Optical runtime ready" }), _jsx("h1", { children: "Real-time environment explainer" }), _jsx("p", { children: "The project now has a runnable server entrypoint and a minimal app shell. This page is intentionally lightweight while the camera, audio, and AI flow are still being built out." }), _jsxs("div", { className: "grid", children: [_jsxs("article", { className: "card", children: [_jsx("h2", { children: "HTTP" }), _jsxs("p", { children: ["Server root: ", _jsxs("code", { children: ["http://", host] })] }), _jsxs("p", { children: ["Health check: ", _jsx("code", { children: "/health" })] })] }), _jsxs("article", { className: "card", children: [_jsx("h2", { children: "WebSocket" }), _jsxs("p", { children: ["Attach a client to ", _jsxs("code", { children: ["ws://", host] })] }), _jsxs("p", { children: ["Connection status: ", _jsx("span", { id: "status", children: "checking..." })] })] }), _jsxs("article", { className: "card", children: [_jsx("h2", { children: "Environment" }), _jsxs("p", { children: ["Port: ", _jsx("code", { children: port })] }), _jsxs("p", { children: ["Gemini key is read from ", _jsx("code", { children: "GEMINI_API_KEY" }), " when used."] })] })] })] }) }), _jsx("script", { dangerouslySetInnerHTML: {
                            __html: `
                            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
                            const status = document.getElementById('status');
                            const socket = new WebSocket(\`\${protocol}://\${window.location.host}\`);
                            socket.addEventListener('open', () => { status.textContent = 'connected'; });
                            socket.addEventListener('close', () => { status.textContent = 'disconnected'; });
                            socket.addEventListener('error', () => { status.textContent = 'error'; });
                        `
                        } })] })] }));
    return '<!doctype html>' + renderToStaticMarkup(app);
}
//# sourceMappingURL=index.js.map