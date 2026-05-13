import { useState, useEffect, useRef, useCallback } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [source, setSource] = useState(null); // 'webcam' | 'room_camera' | null
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Try to start webcam
  const startWebcam = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (err) {
          if (err.name === 'AbortError') return; // interrupted by another load — ignore
          throw err;
        }
      }

      setStream(mediaStream);
      setSource('webcam');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Permissao de camera negada.');
      } else if (err.name === 'NotFoundError') {
        setError('Nenhuma camera encontrada.');
      } else {
        setError('Erro ao acessar camera: ' + err.message);
      }
    }
  }, []);

  // Stop webcam
  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setSource(null);
    }
  }, [stream]);

  // Fall back to room camera crop
  const useRoomCrop = useCallback((frameBase64) => {
    stopWebcam();
    setSource('room_camera');
    // Store the frame for processing
    if (canvasRef.current && frameBase64) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = frameBase64;
    }
  }, [stopWebcam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return {
    stream,
    source,
    error,
    videoRef,
    canvasRef,
    startWebcam,
    stopWebcam,
    useRoomCrop,
  };
}
