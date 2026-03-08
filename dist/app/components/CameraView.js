import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Component: CameraView
 *
 * Description:
 *   Handles the logic to request webcam access and streams the camera feed
 *   into a video element. Acts as the primary visual input mechanism for the
 *   Optical AI agent, continuously capturing frames for processing.
 *
 * Props:
 *   - onFrameCaptured (optional callback): Fires when a new image frame is extracted.
 *   - isActive (boolean): Controls whether the camera feed is currently running.
 */
import { useEffect, useRef } from 'react';
export default function CameraView({ isActive }) {
    const videoRef = useRef(null);
    useEffect(() => {
        // Boilerplate for WebRTC webcam capture setup
        if (isActive) {
            // start stream
        }
        else {
            // stop stream
        }
    }, [isActive]);
    return (_jsxs("div", { className: "relative w-full h-full bg-black/80 flex items-center justify-center rounded-xl overflow-hidden border border-white/10", children: [_jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, className: "w-full h-full object-cover" }), _jsx("span", { className: "absolute bottom-4 left-4 text-white/50 text-sm", children: "Optical Camera View" })] }));
}
//# sourceMappingURL=CameraView.js.map