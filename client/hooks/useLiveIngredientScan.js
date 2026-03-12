import { useEffect, useRef, useState } from 'react';

const WS_URL = 'ws://localhost:5000/ws/scan';
const FRAME_INTERVAL_MS = 1000;
const JPEG_QUALITY = 0.7;
const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 360;

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to serialize camera frame'));
    reader.readAsDataURL(blob);
  });

export const useLiveIngredientScan = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [detectedIngredients, setDetectedIngredients] = useState([]);
  const [confirmedIngredients, setConfirmedIngredients] = useState([]);
  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [scanError, setScanError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);

  const stopSampling = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setVideoStream(null);
  };

  const closeSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setSocket(null);
  };

  const resetScanState = () => {
    stopSampling();
    stopTracks();
    closeSocket();
    setIsScanning(false);
    setDetectedIngredients([]);
    setConfirmedIngredients([]);
    setSessionId(null);
    setScanError('');
  };

  const startScan = async () => {
    setScanError('');
    stopSampling();
    stopTracks();
    closeSocket();
    const nextSessionId = `scan_${Date.now()}`;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: FRAME_WIDTH },
        height: { ideal: FRAME_HEIGHT }
      },
      audio: false
    });

    const nextSocket = new WebSocket(WS_URL);
    socketRef.current = nextSocket;
    setSocket(nextSocket);
    setSessionId(nextSessionId);
    streamRef.current = stream;
    setVideoStream(stream);
    setDetectedIngredients([]);
    setConfirmedIngredients([]);
    setIsScanning(true);

    nextSocket.addEventListener('open', () => {
      nextSocket.send(
        JSON.stringify({
          type: 'scan:start',
          sessionId: nextSessionId
        })
      );
    });

    nextSocket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'scan:update') {
        setDetectedIngredients(Array.isArray(payload.ingredients) ? payload.ingredients : []);
      }

      if (payload.type === 'scan:stopped') {
        const stableNames = Array.isArray(payload.ingredients)
          ? payload.ingredients.map((ingredient) => ingredient.name)
          : [];
        setDetectedIngredients(Array.isArray(payload.ingredients) ? payload.ingredients : []);
        setConfirmedIngredients(stableNames);
      }

      if (payload.type === 'scan:error') {
        setScanError(payload.error || 'Ingredient scan failed');
      }
    });

    nextSocket.addEventListener('close', () => {
      setSocket(null);
    });
  };

  const stopScan = () => {
    stopSampling();
    stopTracks();

    if (socketRef.current && sessionId && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'scan:stop',
          sessionId
        })
      );
    }

    setIsScanning(false);
    setConfirmedIngredients(detectedIngredients.map((ingredient) => ingredient.name));
  };

  const finalizeIngredients = (ingredients) => {
    if (socketRef.current && sessionId && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'scan:finalize',
          sessionId,
          ingredients
        })
      );
    }
  };

  useEffect(() => {
    if (!videoRef.current || !videoStream) {
      return undefined;
    }

    videoRef.current.srcObject = videoStream;
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [videoStream]);

  useEffect(() => {
    if (!isScanning || !videoStream || !socket || !sessionId) {
      return undefined;
    }

    const captureFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      canvas.width = FRAME_WIDTH;
      canvas.height = FRAME_HEIGHT;
      context.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      );

      if (!blob) {
        return;
      }

      const image = await blobToDataUrl(blob);
      socket.send(
        JSON.stringify({
          type: 'scan:frame',
          sessionId,
          image
        })
      );
    };

    intervalRef.current = window.setInterval(() => {
      captureFrame().catch(() => {
        setScanError('Camera frame capture failed');
      });
    }, FRAME_INTERVAL_MS);

    return () => {
      stopSampling();
    };
  }, [isScanning, sessionId, socket, videoStream]);

  useEffect(
    () => () => {
      stopSampling();
      stopTracks();
      closeSocket();
    },
    []
  );

  return {
    isScanning,
    videoStream,
    detectedIngredients,
    confirmedIngredients,
    socket,
    sessionId,
    scanError,
    setConfirmedIngredients,
    startScan,
    stopScan,
    finalizeIngredients,
    resetScanState,
    videoRef,
    canvasRef
  };
};
