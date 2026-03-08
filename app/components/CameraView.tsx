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

interface CameraViewProps {
    isActive: boolean;
}

export default function CameraView({ isActive }: CameraViewProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        // Boilerplate for WebRTC webcam capture setup
        if (isActive) {
            // start stream
        } else {
            // stop stream
        }
    }, [isActive]);

    return (
        <div className="relative w-full h-full bg-black/80 flex items-center justify-center rounded-xl overflow-hidden border border-white/10">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <span className="absolute bottom-4 left-4 text-white/50 text-sm">Optical Camera View</span>
        </div>
    );
}
