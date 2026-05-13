import { useEffect, useRef, useState } from 'react';
import { useAttention } from '../hooks/useAttention';
import { useCamera } from '../hooks/useCamera';
import CameraPreview from './CameraPreview';
import AttentionIndicator from './AttentionIndicator';

export default function AttentionMonitor({ classId, studentId, monitoringMode = 'full_attention' }) {
  const workerRef = useRef(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState(null);
  // Refs updated every frame from the worker — read by CameraPreview draw loop without causing re-renders
  const landmarksRef = useRef(null);
  const poseRef = useRef({ yaw: 0, pitch: 0, roll: 0 });
  // Backpressure flag: only send next frame when worker finishes previous one
  const workerBusyRef = useRef(false);

  const { source, error: cameraError, videoRef, startWebcam, stopWebcam } = useCamera();
  const { status, processPose, processNoFace, resetNoFace } = useAttention(
    classId, studentId, monitoringMode, source || 'webcam'
  );

  useEffect(() => {
    try {
      const worker = new Worker('/attention-worker.js');
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const { type, yaw, pitch, roll, ear, landmarkBuffer } = event.data;
        switch (type) {
          case 'ready':
            setWorkerReady(true);
            break;
          case 'pose':
            workerBusyRef.current = false;
            if (landmarkBuffer) landmarksRef.current = landmarkBuffer;
            poseRef.current = { yaw, pitch, roll };
            resetNoFace();
            processPose({ yaw, pitch, roll, ear });
            break;
          case 'no_face':
            workerBusyRef.current = false;
            processNoFace();
            break;
          case 'error':
            workerBusyRef.current = false;
            console.warn('Attention worker:', event.data.message);
            break;
        }
      };

      worker.postMessage({ type: 'init' });
    } catch {
      setWorkerError('Web Worker não suportado.');
    }

    return () => {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    };
  }, []);

  useEffect(() => {
    startWebcam();
    return () => stopWebcam();
  }, []);

  useEffect(() => {
    if (!workerReady || !workerRef.current || !videoRef.current) return;

    const video = videoRef.current;
    let animId;

    function captureLoop() {
      // Only send a frame when the worker has finished the previous one (backpressure).
      // This prevents landmark lag caused by a backed-up processing queue.
      if (!workerBusyRef.current && video.readyState >= 2 && workerRef.current) {
        workerBusyRef.current = true;
        const offscreen = new OffscreenCanvas(video.videoWidth || 640, video.videoHeight || 480);
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(video, 0, 0);
        createImageBitmap(offscreen).then(bitmap => {
          if (workerRef.current) {
            workerRef.current.postMessage({ type: 'frame', imageBitmap: bitmap, timestamp: Date.now() }, [bitmap]);
          } else {
            workerBusyRef.current = false;
          }
        }).catch(() => { workerBusyRef.current = false; });
      }
      animId = requestAnimationFrame(captureLoop);
    }

    captureLoop();
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [workerReady, videoRef.current]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <CameraPreview
          videoRef={videoRef}
          source={source}
          error={cameraError}
          landmarksRef={landmarksRef}
          poseRef={poseRef}
        />
        {status !== 'disconnected' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60">
            <AttentionIndicator status={status} showLabel size={10} />
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 m-0 text-center">
        Fonte: {source === 'webcam' ? 'Webcam' : source === 'room_camera' ? 'Câmera da sala' : 'Nenhuma'}
        {!workerReady && ' · Carregando detector...'}
        {workerError && ` · ${workerError}`}
      </p>
    </div>
  );
}
