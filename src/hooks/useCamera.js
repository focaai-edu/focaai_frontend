import { useState, useEffect, useRef, useCallback } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [source, setSource] = useState(null); // 'webcam' | 'room_camera' | null
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  // Cada tentativa tem um número; sair da tela invalida as pendentes. Uma
  // permissão que chega tarde para a câmera na hora, em vez de deixá-la acesa (#4, F11).
  const attemptRef = useRef(0);

  // Try to start webcam
  const startWebcam = useCallback(async () => {
    const attempt = ++attemptRef.current;
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      const release = () => mediaStream.getTracks().forEach((t) => t.stop());
      if (attempt !== attemptRef.current) { release(); return; }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (err) {
          // Interrompido por outra carga: esta tentativa não vale mais.
          if (err.name === 'AbortError') { release(); return; }
          throw err;
        }
      }
      if (attempt !== attemptRef.current) { release(); return; }

      // Webcam desconectada (ou permissão revogada) durante a aula (#8, F03).
      mediaStream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => setError('Câmera desconectada.'));
      });

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

  useEffect(() => () => { attemptRef.current += 1; }, []);

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
