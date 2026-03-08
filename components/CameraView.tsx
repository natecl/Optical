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

import { useEffect, useRef, useState } from "react";

interface CameraViewProps {
  isActive: boolean;
}

export default function CameraView({ isActive }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stopStream = () => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const startStream = async () => {
      if (!isActive) {
        setStatus("idle");
        setErrorMsg(null);
        stopStream();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMsg("Camera API is not available in this browser.");
        return;
      }

      setStatus("starting");
      setErrorMsg(null);
      stopStream();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            // Playback can still succeed after user interaction; keep stream alive.
          });
        }

        setStatus("active");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to access camera.";
        setStatus("error");
        setErrorMsg(message);
        stopStream();
      }
    };

    void startStream();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isActive]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/80">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      <span className="absolute bottom-4 left-4 text-sm text-white/60">Optical Camera View</span>

      {status !== "active" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
          <p className="rounded-md border border-white/20 bg-black/55 px-3 py-2 text-sm text-white/80">
            {status === "starting" ? "Starting camera..." : errorMsg ?? "Camera inactive"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
