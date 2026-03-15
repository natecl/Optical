import { useEffect, useRef, useState, useCallback } from 'react';

export const useCookingCamera = () => {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setStream(null);
  }, []);

  const startCamera = useCallback(async (facing) => {
    setCameraError('');
    stopTracks();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing || facingMode } },
        audio: false
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (_error) {
      setCameraError('Camera access failed. Please allow camera permission.');
    }
  }, [facingMode, stopTracks]);

  const toggleCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  useEffect(() => () => stopTracks(), [stopTracks]);

  return {
    stream,
    facingMode,
    cameraError,
    videoRef,
    startCamera,
    stopTracks,
    toggleCamera
  };
};
