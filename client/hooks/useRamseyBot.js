import { useState, useRef, useCallback, useEffect } from 'react';

const WS_URL = 'ws://localhost:5000/ws/cooking-live';
const VIDEO_INTERVAL_MS = 1000;
const VIDEO_SIZE = 768;

export const useRamseyBot = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const micStreamRef = useRef(null);
  const captureContextRef = useRef(null);
  const captureNodeRef = useRef(null);
  const playbackContextRef = useRef(null);
  const playbackNodeRef = useRef(null);
  const videoIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const isMutedRef = useRef(false);

  // Keep ref in sync with state for use inside worklet callback
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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

    if (playbackNodeRef.current) {
      playbackNodeRef.current.port.postMessage({ type: 'stop' });
      playbackNodeRef.current.disconnect();
      playbackNodeRef.current = null;
    }

    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setIsConnected(false);
    setIsModelSpeaking(false);
    setAudioLevel(0);
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

    await audioCtx.audioWorklet.addModule('/audio/pcm-capture-processor.js');

    const source = audioCtx.createMediaStreamSource(micStream);
    const captureNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');
    captureNodeRef.current = captureNode;

    captureNode.port.onmessage = (event) => {
      if (event.data.type === 'audio' && socketRef.current?.readyState === 1) {
        if (!isMutedRef.current) {
          socketRef.current.send(event.data.buffer);
        }
        setAudioLevel(isMutedRef.current ? 0 : event.data.level);
      }
    };

    source.connect(captureNode);
    captureNode.connect(audioCtx.destination); // Required to keep processing alive
  }, []);

  const setupPlayback = useCallback(async () => {
    const playbackCtx = new AudioContext({ sampleRate: 24000 });
    playbackContextRef.current = playbackCtx;

    await playbackCtx.audioWorklet.addModule('/audio/pcm-playback-processor.js');

    const playbackNode = new AudioWorkletNode(playbackCtx, 'pcm-playback-processor', {
      outputChannelCount: [2],
    });
    playbackNodeRef.current = playbackNode;

    playbackNode.port.onmessage = (event) => {
      if (event.data.type === 'level') {
        setIsModelSpeaking(event.data.playing);
      }
    };

    playbackNode.connect(playbackCtx.destination);
  }, []);

  const startVideoCapture = useCallback((videoRef) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = VIDEO_SIZE;
      canvasRef.current.height = VIDEO_SIZE;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    videoIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || !socketRef.current?.readyState === 1) return;

      ctx.drawImage(video, 0, 0, VIDEO_SIZE, VIDEO_SIZE);
      canvas.toBlob(
        (blob) => {
          if (!blob || !socketRef.current?.readyState === 1) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            socketRef.current.send(
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
    async (cookingSessionId, videoRef) => {
      setError('');

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

        socket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Binary: audio from Gemini
            if (playbackNodeRef.current) {
              playbackNodeRef.current.port.postMessage(
                { type: 'audio', buffer: event.data },
                [event.data]
              );
            }
            return;
          }

          // Text: JSON control messages
          let msg;
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }

          if (msg.type === 'live:ready') {
            setIsConnected(true);
            // Start mic capture after Gemini session is ready
            startMicCapture().catch((err) => {
              setError('Microphone access failed: ' + err.message);
            });
            // Start video frame capture
            if (videoRef) {
              startVideoCapture(videoRef);
            }
          } else if (msg.type === 'live:transcript') {
            setTranscript((prev) => [...prev.slice(-19), { role: msg.role, text: msg.text }]);
          } else if (msg.type === 'live:turn_complete') {
            setIsModelSpeaking(false);
          } else if (msg.type === 'live:error') {
            setError(msg.error || 'Voice agent error');
          }
        };

        socket.onerror = () => {
          setError('WebSocket connection error');
        };

        socket.onclose = () => {
          setIsConnected(false);
          setIsModelSpeaking(false);
        };
      } catch (err) {
        setError(err.message || 'Failed to start voice session');
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

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return {
    isConnected,
    isModelSpeaking,
    audioLevel,
    transcript,
    isMuted,
    error,
    startVoiceSession,
    stopVoiceSession,
    toggleMute,
  };
};
