import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ModeToggle({ currentMode, onModeChange }) {
    return (_jsxs("div", { className: "flex bg-white/5 rounded-full p-1 border border-white/10", children: [_jsx("button", { onClick: () => onModeChange('standard'), className: `px-4 py-2 rounded-full text-sm font-medium transition-colors ${currentMode === 'standard' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`, children: "Standard" }), _jsx("button", { onClick: () => onModeChange('learning'), className: `px-4 py-2 rounded-full text-sm font-medium transition-colors ${currentMode === 'learning' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`, children: "Learning" })] }));
}
//# sourceMappingURL=ModeToggle.js.map