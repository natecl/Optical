/**
 * Component: MicrophoneInput
 * 
 * Description:
 *   Captures user voice input for processing by the conversational AI.
 *   Streams audio chunks via WebSocket or Web Audio API to the backend.
 * 
 * Props:
 *   - isListening (boolean): State determining if audio is actively captured.
 *   - onAudioData (optional callback): Executed whenever an audio chunk is available.
 */

import { useEffect, useRef, useState } from "react";

interface MicrophoneInputProps {
  onAudioData?: (chunk: Blob) => void;
}

export default function MicrophoneInput({ onAudioData }: MicrophoneInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopMeter = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setInputLevel(0);
  };

  const teardownAudioGraph = () => {
    stopMeter();
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const stopListening = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    teardownAudioGraph();
    setIsListening(false);
    setStatus("idle");
  };

  const runMeter = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const values = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(values);
      let sumSquares = 0;
      for (const value of values) {
        const normalized = (value - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / values.length);
      setInputLevel(Math.min(100, Math.round(rms * 220)));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMsg("Microphone API is not available in this browser.");
      return;
    }

    setStatus("starting");
    setErrorMsg(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      source.connect(analyser);
      runMeter();

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          onAudioData?.(event.data);
        }
      };

      recorder.onerror = () => {
        setStatus("error");
        setErrorMsg("Audio recorder encountered an error.");
      };

      recorderRef.current = recorder;
      recorder.start(500);
      setIsListening(true);
      setStatus("active");
    } catch (error) {
      stopListening();
      setStatus("error");
      const message = error instanceof Error ? error.message : "Unable to access microphone.";
      setErrorMsg(message);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
      return;
    }

    void startListening();
  };

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      const stream = streamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={toggleMic}
        className={`w-full rounded-full p-4 text-white shadow-lg transition-all duration-300 ${
          isListening
            ? "bg-red-500 hover:bg-red-600"
            : "bg-white/10 hover:bg-white/20"
        }`}
      >
        {isListening ? "Stop Listening" : "Start Listening"}
      </button>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-100"
          style={{ width: `${inputLevel}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-white/60">
        {status === "active"
          ? "Microphone active"
          : status === "starting"
            ? "Starting microphone..."
            : status === "error"
              ? errorMsg ?? "Microphone error"
              : "Microphone idle"}
      </p>
    </div>
  );
}
