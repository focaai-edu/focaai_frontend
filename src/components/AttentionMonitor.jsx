import { useEffect, useRef, useState } from 'react';
import { useAttention } from '../hooks/useAttention';
import { useCamera } from '../hooks/useCamera';
import CameraPreview from './CameraPreview';
import AttentionIndicator from './AttentionIndicator';

const NO_CAMERA_TEXT = 'Não foi possível acessar a câmera. Seu professor verá você como sem câmera.';
const DETECTOR_ERROR_TEXT = 'Não foi possível iniciar o detector de atenção.';

export default function AttentionMonitor({ classId, monitoringMode = 'full_attention' }) {
  const workerRef = useRef(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState(null);
  // Falha ao carregar o MediaPipe (CDN/modelo); cada tentativa recria o worker (#8, F16).
  const [detectorFailed, setDetectorFailed] = useState(false);
  const [workerAttempt, setWorkerAttempt] = useState(0);
  // Refs updated every frame from the worker — read by CameraPreview draw loop without causing re-renders
  const landmarksRef = useRef(null);
  const poseRef = useRef({ yaw: 0, pitch: 0, roll: 0 });
  // Backpressure flag: only send next frame when worker finishes previous one
  const workerBusyRef = useRef(false);

  const { source, error: cameraError, videoRef, startWebcam, stopWebcam } = useCamera();
  const { status, processPose, processNoFace, resetNoFace, markNoCamera } = useAttention(
    classId, monitoringMode, source || 'webcam'
  );
  // O onmessage do worker é registrado uma vez; ele chama os handlers do render
  // mais recente por esta ref, senão a decisão fica presa no modo inicial (#8, F01).
  const handlersRef = useRef(null);
  handlersRef.current = { processPose, processNoFace, resetNoFace, markNoCamera };

  useEffect(() => {
    let ready = false;
    try {
      const worker = new Worker('/attention-worker.js');
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const { type, yaw, pitch, roll, ear, landmarkBuffer } = event.data;
        switch (type) {
          case 'ready':
            ready = true;
            setWorkerReady(true);
            break;
          case 'pose':
            workerBusyRef.current = false;
            if (landmarkBuffer) landmarksRef.current = landmarkBuffer;
            poseRef.current = { yaw, pitch, roll };
            handlersRef.current.resetNoFace();
            handlersRef.current.processPose({ yaw, pitch, roll, ear });
            break;
          case 'no_face':
            workerBusyRef.current = false;
            landmarksRef.current = null;
            handlersRef.current.processNoFace();
            break;
          case 'error':
            workerBusyRef.current = false;
            console.warn('Attention worker:', event.data.message);
            // Antes do `ready` é falha de inicialização: o aluno não está sendo
            // monitorado. Depois, é erro de um frame só, e o próximo segue (CA9).
            if (!ready) {
              setDetectorFailed(true);
              handlersRef.current.markNoCamera();
            }
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
  }, [workerAttempt]);

  function retryDetector() {
    setDetectorFailed(false);
    setWorkerReady(false);
    setWorkerAttempt((n) => n + 1);
  }

  useEffect(() => {
    startWebcam();
    return () => stopWebcam();
  }, []);

  // Câmera negada, ausente ou desconectada: sem frames, o status nunca viraria
  // no_camera pela ausência de rosto, então é marcado na hora (#8, F03).
  useEffect(() => {
    if (cameraError) markNoCamera();
  }, [cameraError, monitoringMode, markNoCamera]);

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
          error={cameraError ? NO_CAMERA_TEXT : null}
          landmarksRef={landmarksRef}
          poseRef={poseRef}
          status={status}
        />
        {status !== 'disconnected' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60">
            <AttentionIndicator status={status} showLabel size={10} />
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 m-0 text-center">
        Fonte: {source === 'webcam' ? 'Webcam' : source === 'room_camera' ? 'Câmera da sala' : 'Nenhuma'}
        {!workerReady && !detectorFailed && ' · Carregando detector...'}
        {workerError && ` · ${workerError}`}
      </p>
      {detectorFailed && (
        <div role="alert" className="flex flex-col items-center gap-2 text-sm text-center">
          <p className="m-0 text-red-500">{DETECTOR_ERROR_TEXT}</p>
          <button
            type="button"
            onClick={retryDetector}
            className="px-3 py-1.5 rounded bg-secondary text-white text-sm hover:bg-primary transition-colors"
          >
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}
