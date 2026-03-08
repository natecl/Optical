import { jsx as _jsx } from "react/jsx-runtime";
export default function OverlayLabels({ objects = [] }) {
    return (_jsx("div", { className: "absolute inset-0 pointer-events-none", children: objects.map((obj, idx) => (_jsx("div", { className: "absolute border-2 border-green-500 rounded bg-black/40 text-green-400 text-xs font-bold px-1", style: {
                top: `${obj.y}%`,
                left: `${obj.x}%`,
                width: `${obj.width}%`,
                height: `${obj.height}%`
            }, children: obj.label }, idx))) }));
}
//# sourceMappingURL=OverlayLabels.js.map