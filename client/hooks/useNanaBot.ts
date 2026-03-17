import { useState, useRef, useCallback, useEffect } from 'react';
import type { CookingLiveServerMessage } from '../../types/websocket';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  || 'http://localhost:5000';
const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.replace(/\/$/, '')
  || API_BASE_URL.replace(/^http/, 'ws');
const WS_URL = `${WS_BASE_URL}/ws/cooking-live`;
const VIDEO_INTERVAL_MS = 1000;
const VIDEO_SIZE = 768;

interface TranscriptEntry {
  role: 'user' | 'model';
  text: string;
}

export const useNanaBot = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackGainRef = useRef<GainNode | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPausedRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingInterruptionRef = useRef(false);

  // Keep ref in sync with state for use inside worklet callback
  useEffect(() => {
    isPausedRef.current = isPaused;
    const playbackCtx = playbackContextRef.current;
    if (!playbackCtx) return;

    if (isPaused) {
      if (playbackCtx.state === 'running') {
        playbackCtx.suspend().catch(() => {});
      }
      setIsModelSpeaking(false);
      return;
    }

    const resumePlayback = async () => {
      if (playbackCtx.state === 'suspended') {
        await playbackCtx.resume().catch(() => {});
      }
      // If audio chunks were queued while paused, reflect speaking state immediately on resume.
      if (nextPlayTimeRef.current > playbackCtx.currentTime + 0.05) {
        setIsModelSpeaking(true);
      }
    };

    void resumePlayback();
  }, [isPaused]);

  // iOS/mobile: AudioContext can only be resumed inside a user gesture.
  // Re-attempt resume on every tap/click until both contexts are running.
  useEffect(() => {
    const resumeContexts = () => {
      if (captureContextRef.current?.state === 'suspended') {
        captureContextRef.current.resume().catch(() => {});
      }
      if (!isPausedRef.current && playbackContextRef.current?.state === 'suspended') {
        playbackContextRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener('touchstart', resumeContexts);
    document.addEventListener('click', resumeContexts);
    return () => {
      document.removeEventListener('touchstart', resumeContexts);
      document.removeEventListener('click', resumeContexts);
    };
  }, []);

  const cleanup = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (captureNodeRef.current) {
      captureNodeRef.current.disconnect();
      captureNodeRef.current = null;
    }

    if (captureContextRef.current) {
      captureContextRef.current.close().catch(() => {});
      captureContextRef.current = null;
    }

    nextPlayTimeRef.current = 0;
    scheduledSourcesRef.current = [];

    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
    playbackGainRef.current = null;

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (socketRef.current) {
      intentionalCloseRef.current = true;
      socketRef.current.close();
      socketRef.current = null;
    }

    setIsConnected(false);
    setIsModelSpeaking(false);
    setAudioLevel(0);
    setIsPaused(false);
  }, []);

  const flushAudioPlayback = useCallback(() => {
    // Stop all scheduled audio sources immediately
    for (const source of scheduledSourcesRef.current) {
      try {
        source.stop();
      } catch (_e) {
        // Already stopped
      }
    }
    scheduledSourcesRef.current = [];

    // Reset the play time so new audio starts immediately
    nextPlayTimeRef.current = 0;
    setIsModelSpeaking(false);

    // Drop any audio chunks still in transit from the old turn
    pendingInterruptionRef.current = true;
  }, []);

  const startMicCapture = useCallback(async () => {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    micStreamRef.current = micStream;

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    captureContextRef.current = audioCtx;
    await audioCtx.resume();

    await audioCtx.audioWorklet.addModule('/audio/pcm-capture-processor.js');

    const source = audioCtx.createMediaStreamSource(micStream);
    const captureNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
    captureNodeRef.current = captureNode;

    captureNode.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'audio' && socketRef.current?.readyState === 1) {
        socketRef.current.send(event.data.buffer);
        setAudioLevel(event.data.level);
      }
    };

    source.connect(captureNode);
    captureNode.connect(audioCtx.destination); // Required to keep processing alive
  }, []);

  const nextPlayTimeRef = useRef(0);

  const setupPlayback = useCallback(async () => {
    const playbackCtx = new AudioContext({ sampleRate: 24000 });
    playbackContextRef.current = playbackCtx;
    await playbackCtx.resume();

    const gainNode = playbackCtx.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(playbackCtx.destination);
    playbackGainRef.current = gainNode;

    // Detect if browser blocked audio autoplay
    if (playbackCtx.state === 'suspended') {
      setAudioBlocked(true);
    }
    playbackCtx.addEventListener('statechange', () => {
      if (playbackCtx.state === 'running') {
        setAudioBlocked(false);
      }
    });

    nextPlayTimeRef.current = 0;
    console.log('[Playback] AudioContext created, sampleRate:', playbackCtx.sampleRate, 'state:', playbackCtx.state);
  }, []);

  const startVideoCapture = useCallback((videoRef: React.RefObject<HTMLVideoElement | null>) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = VIDEO_SIZE;
      canvasRef.current.height = VIDEO_SIZE;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    videoIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || socketRef.current?.readyState !== 1) return;

      ctx!.drawImage(video, 0, 0, VIDEO_SIZE, VIDEO_SIZE);
      canvas.toBlob(
        (blob) => {
          if (!blob || socketRef.current?.readyState !== 1) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            socketRef.current!.send(
              JSON.stringify({ type: 'live:video', image: base64 })
            );
          };
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.7
      );
    }, VIDEO_INTERVAL_MS);
  }, []);

  const startVoiceSession = useCallback(
    async (cookingSessionId: string, videoRef?: React.RefObject<HTMLVideoElement | null>) => {
      setError('');
      intentionalCloseRef.current = false;

      try {
        // Set up audio playback first
        await setupPlayback();

        // Connect WebSocket
        const socket = new WebSocket(WS_URL);
        socketRef.current = socket;

        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'live:start', cookingSessionId }));
        };

        socket.onmessage = (event: MessageEvent) => {
          if (event.data instanceof ArrayBuffer) {
            // Binary: raw PCM 16-bit audio from Gemini at 24kHz
            // Drop stale audio chunks from the old turn after a step change
            if (pendingInterruptionRef.current) {
              return;
            }

            const ctx = playbackContextRef.current;
            if (!ctx || ctx.state === 'closed') {
              console.log('[Playback] Skipping audio, ctx state:', ctx?.state);
              return;
            }

            const pcm16 = new Int16Array(event.data);
            const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < pcm16.length; i++) {
              channelData[i] = pcm16[i] / 32768;
            }

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(playbackGainRef.current ?? ctx.destination);

            // Schedule chunks back-to-back to avoid gaps
            const now = ctx.currentTime;
            const startTime = Math.max(now, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + audioBuffer.duration;

            // Track scheduled source so it can be cancelled on interruption
            scheduledSourcesRef.current.push(source);

            if (!isPausedRef.current) {
              setIsModelSpeaking(true);
            }
            source.onended = () => {
              // Remove from tracked sources
              const idx = scheduledSourcesRef.current.indexOf(source);
              if (idx !== -1) scheduledSourcesRef.current.splice(idx, 1);

              if (nextPlayTimeRef.current <= ctx.currentTime + 0.05) {
                setIsModelSpeaking(false);
              }
            };

            console.log(`[Playback] Queued ${pcm16.length} samples at ${startTime.toFixed(3)}, duration=${audioBuffer.duration.toFixed(3)}s`);
            return;
          }

          // Text: JSON control messages
          let msg: CookingLiveServerMessage;
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }

          if (msg.type === 'live:ready') {
            setIsConnected(true);
            // Start mic capture after Gemini session is ready
            startMicCapture().catch((err: Error) => {
              setError('Microphone access failed: ' + err.message);
            });
            // Start video frame capture
            if (videoRef) {
              startVideoCapture(videoRef);
            }
          } else if (msg.type === 'live:transcript') {
            setTranscript((prev) => [...prev.slice(-19), { role: msg.role, text: msg.text }]);
          } else if (msg.type === 'live:turn_complete') {
            // The old turn has ended — allow audio from the new turn to play
            pendingInterruptionRef.current = false;
            setIsModelSpeaking(false);
          } else if (msg.type === 'live:interrupted') {
            // Server interrupted Gemini's turn — flush queued audio immediately
            // then reset the flag so new-turn audio from the next step plays
            flushAudioPlayback();
            pendingInterruptionRef.current = false;
          } else if (msg.type === 'live:error') {
            setError(msg.error || 'Voice agent error');
          }
        };

        socket.onerror = () => {
          if (!intentionalCloseRef.current) {
            setError('WebSocket connection error');
          }
        };

        socket.onclose = () => {
          setIsConnected(false);
          setIsModelSpeaking(false);
        };
      } catch (err) {
        setError((err as Error).message || 'Failed to start voice session');
        cleanup();
      }
    },
    [startMicCapture, setupPlayback, startVideoCapture, cleanup]
  );

  const stopVoiceSession = useCallback(() => {
    if (socketRef.current?.readyState === 1) {
      socketRef.current.send(JSON.stringify({ type: 'live:stop' }));
    }
    cleanup();
  }, [cleanup]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const notifyStepChange = useCallback((stepIndex: number) => {
    if (socketRef.current?.readyState === 1) {
      // Flush local audio immediately so the user hears silence right away
      flushAudioPlayback();
      // Tell the server to interrupt Gemini and switch to the new step
      socketRef.current.send(JSON.stringify({ type: 'live:step_changed', stepIndex }));
    }
  }, [flushAudioPlayback]);

  const unlockAudio = useCallback(() => {
    if (!isPausedRef.current && playbackContextRef.current?.state === 'suspended') {
      playbackContextRef.current.resume().catch(() => {});
    }
    if (captureContextRef.current?.state === 'suspended') {
      captureContextRef.current.resume().catch(() => {});
    }
    setAudioBlocked(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return {
    isConnected,
    isModelSpeaking,
    audioLevel,
    transcript,
    isPaused,
    audioBlocked,
    error,
    startVoiceSession,
    stopVoiceSession,
    togglePause,
    unlockAudio,
    notifyStepChange,
  };
};
