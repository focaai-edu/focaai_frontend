import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../../services/socket';
import api from '../../services/api';

// Thresholds per monitoring mode (degrees)
const MODE_THRESHOLDS = {
  full_attention: { yaw: 35, pitch_up: 25, pitch_down: 20 },
  activity:       { yaw: 40, pitch_up: 30, pitch_down: null },
  exam:           { yaw: 25, pitch_up: 20, pitch_down: null },
  break:          null,
};

// Copied from attention-worker.js — same empirically verified axis mapping
function computeHeadPose(m) {
  if (!m || m.length < 16) return { yaw: 0, pitch: 0, roll: 0 };
  const m00 = m[0], m10 = m[1], m20 = m[2];
  const m01 = m[4], m11 = m[5], m21 = m[6];
  const m02 = m[8], m12 = m[9], m22 = m[10];
  const RAD2DEG = 180 / Math.PI;
  const sy = Math.sqrt(m00 * m00 + m10 * m10);
  return {
    yaw:   Math.atan2(-m20, sy) * RAD2DEG,
    pitch: Math.atan2(m21, m22) * RAD2DEG,
    roll:  Math.atan2(m10, m00) * RAD2DEG,
  };
}

function isDistracted(yaw, pitch, mode) {
  const t = MODE_THRESHOLDS[mode || 'full_attention'];
  if (!t) return false;
  if (Math.abs(yaw) > t.yaw) return true;
  if (t.pitch_up !== null && pitch > t.pitch_up) return true;
  if (t.pitch_down !== null && pitch < -t.pitch_down) return true;
  return false;
}

export default function RoomCamera() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastDetectRef = useRef(0);
  const currentModeRef = useRef('full_attention');
  const selectedClassIdRef = useRef(null);

  const [streamActive, setStreamActive] = useState(false);
  const [error, setError] = useState('');
  const [liveClass, setLiveClass] = useState(null);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [mpReady, setMpReady] = useState(false);
  const [mpError, setMpError] = useState('');
  const [aggregate, setAggregate] = useState(null); // { total, attentive, distracted, pct }

  useEffect(() => {
    api.get('/api/classes', { params: { status: 'live' } })
      .then(res => {
        setAvailableClasses(res.data.classes);
        if (res.data.classes.length > 0) {
          setSelectedClassId(res.data.classes[0].id);
          setLiveClass(res.data.classes[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { selectedClassIdRef.current = selectedClassId; }, [selectedClassId]);
  useEffect(() => {
    if (liveClass?.monitoring_mode) currentModeRef.current = liveClass.monitoring_mode;
  }, [liveClass]);

  // Initialize MediaPipe FaceLandmarker once on mount
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { FilesetResolver, FaceLandmarker } = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
        );
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 10,
        });
        if (!cancelled) {
          landmarkerRef.current = fl;
          setMpReady(true);
        }
      } catch (err) {
        if (!cancelled) setMpError('Erro ao carregar MediaPipe: ' + err.message);
      }
    }
    init();
    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Socket connection tracking and auto-join
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const cid = selectedClassIdRef.current;
      if (cid) socket.emit('join_class', { class_id: cid });
    };
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Join class room when selected
  useEffect(() => {
    if (!selectedClassId) return;
    if (!socket.connected) socket.connect();
    else socket.emit('join_class', { class_id: selectedClassId });
    return () => {
      socket.emit('leave_class', { class_id: selectedClassId });
    };
  }, [selectedClassId]);

  const drawFaceBoxes = useCallback((faceBoxes) => {
    if (!overlayRef.current || !videoRef.current) return;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d');
    const W = videoRef.current.videoWidth || 1280;
    const H = videoRef.current.videoHeight || 720;
    overlay.width = W;
    overlay.height = H;
    ctx.clearRect(0, 0, W, H);
    faceBoxes.forEach(({ x, y, w, h, distracted: dist }) => {
      const px = x * W, py = y * H, pw = w * W, ph = h * H;
      const fx = W - px - pw; // mirror x (video is CSS-flipped)
      const color = dist ? '#F59E0B' : '#22C55E';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(fx, py, pw, ph);
      ctx.restore();
    });
  }, []);

  const processResults = useCallback((results) => {
    const matrices = results.facialTransformationMatrixes || [];
    const mode = currentModeRef.current;
    let attentive = 0, distracted = 0;
    const faceBoxes = [];

    matrices.forEach((mat, i) => {
      const pose = computeHeadPose(mat.data);
      const dist = isDistracted(pose.yaw, pose.pitch, mode);
      if (dist) distracted++; else attentive++;

      const lms = results.faceLandmarks?.[i];
      if (lms && lms.length > 0) {
        const xs = lms.map(p => p.x);
        const ys = lms.map(p => p.y);
        faceBoxes.push({
          x: Math.min(...xs), y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
          distracted: dist,
        });
      }
    });

    const total = attentive + distracted;
    const pct = total > 0 ? Math.round(attentive / total * 100) : 0;
    setAggregate(total > 0 ? { total, attentive, distracted, pct } : null);
    drawFaceBoxes(faceBoxes);

    const cid = selectedClassIdRef.current;
    if (cid && total > 0) {
      socket.emit('room_attention', {
        class_id: cid,
        total_faces: total,
        attentive,
        distracted,
        attention_pct: pct,
        monitoring_mode: mode,
      });
    }
  }, [drawFaceBoxes]);

  // Detection loop — runs at 2 FPS (500ms throttle) via rAF
  useEffect(() => {
    if (!streamActive || !mpReady) return;
    const INTERVAL = 500;
    function detect(now) {
      rafRef.current = requestAnimationFrame(detect);
      if (now - lastDetectRef.current < INTERVAL) return;
      lastDetectRef.current = now;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !landmarkerRef.current) return;
      try {
        const results = landmarkerRef.current.detectForVideo(video, now);
        processResults(results);
      } catch (e) {
        // ignore occasional detectForVideo errors during stream start/stop
      }
    }
    rafRef.current = requestAnimationFrame(detect);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAggregate(null);
      if (overlayRef.current) {
        const ctx = overlayRef.current.getContext('2d');
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
    };
  }, [streamActive, mpReady, processResults]);

  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreamActive(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') setError('Permissão de câmera negada.');
      else if (err.name === 'NotFoundError') setError('Nenhuma câmera encontrada.');
      else setError('Erro ao acessar câmera: ' + err.message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const mpStatus = mpReady ? 'MediaPipe pronto' : (mpError || 'Carregando MediaPipe...');

  if (availableClasses.length === 0) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-bold text-[#1B4F81] mb-2">foca.ai — Câmera da Sala</h1>
        <p className="text-gray-500 text-sm">Nenhuma aula ao vivo. Inicie uma aula no Dashboard do Professor primeiro.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col">
      <header className="px-6 py-3 bg-[#1B4F81] flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold m-0">foca.ai — Câmera da Sala</h1>
          {liveClass && <span className="text-xs opacity-80">Aula: {liveClass.title}</span>}
        </div>
        <div className="flex gap-2 items-center">
          {!streamActive ? (
            <button onClick={startCamera} className="px-4 py-2 rounded-lg bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors">
              Ligar Câmera
            </button>
          ) : (
            <button onClick={stopCamera} className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors">
              Desligar
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="px-6 py-3 bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-black">
          <div className="relative w-full h-full">
            {/* Diagnostics HUD */}
            {streamActive && (
              <div className="absolute top-3 left-3 z-10 bg-black/60 text-white text-xs font-mono rounded-md px-3 py-2 space-y-0.5 pointer-events-none">
                <div>{connected ? '🟢 Socket conectado' : '🔴 Socket desconectado'}</div>
                <div>{mpReady ? '🟢 MediaPipe pronto' : (mpError ? '🔴 ' + mpError : '🟡 Carregando MediaPipe...')}</div>
                {aggregate && (
                  <div>Rostos: {aggregate.total} · Atentos: {aggregate.attentive} · {aggregate.pct}%</div>
                )}
              </div>
            )}

            {/* Attention badge */}
            {streamActive && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                {aggregate ? (
                  <div className="flex items-center gap-2 bg-green-500/90 text-white font-semibold text-sm rounded-full px-4 py-1.5 shadow-lg animate-pulse">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-white" />
                    {aggregate.attentive}/{aggregate.total} atentos · {aggregate.pct}%
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-black/60 text-gray-300 text-sm rounded-full px-4 py-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
                    Procurando rostos...
                  </div>
                )}
              </div>
            )}

            {/* MediaPipe loading indicator (before stream) */}
            {!streamActive && !mpReady && !mpError && (
              <div className="absolute top-3 right-3 z-10 bg-yellow-500/80 text-white text-xs rounded-md px-3 py-1.5">
                Carregando modelo de detecção...
              </div>
            )}

            {/* Video — always mounted, CSS-flipped for natural mirror view */}
            <div className="w-full h-full" style={{ transform: 'scaleX(-1)' }}>
              <video
                ref={videoRef}
                className={streamActive ? 'w-full h-full object-contain' : 'hidden'}
                playsInline muted autoPlay
              />
            </div>

            {/* Overlay canvas — NOT flipped; box x-coords are mirrored in drawFaceBoxes */}
            {streamActive && (
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full" />
            )}

            {!streamActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[#64748B] text-sm">Câmera desligada. Clique em &quot;Ligar Câmera&quot; para iniciar.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — anonymous aggregate panel */}
        <div className="w-[280px] bg-[#1E293B] p-4 border-l border-[#334155] overflow-y-auto">
          <h3 className="text-base font-semibold mb-3 text-white">Atenção da Turma</h3>
          <div className="space-y-3">
            {aggregate ? (
              <>
                <div className="p-3 rounded-lg bg-[#334155]">
                  <p className="text-2xl font-bold text-white">{aggregate.pct}%</p>
                  <p className="text-xs text-[#94A3B8]">atenção média</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-[#334155] text-center">
                    <p className="text-xl font-bold text-green-400">{aggregate.attentive}</p>
                    <p className="text-xs text-[#94A3B8]">atentos</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#334155] text-center">
                    <p className="text-xl font-bold text-amber-400">{aggregate.distracted}</p>
                    <p className="text-xs text-[#94A3B8]">desatentos</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#334155]">
                  <p className="text-xs text-[#94A3B8] mb-1">Total detectado</p>
                  <p className="text-sm font-semibold text-white">{aggregate.total} rosto(s)</p>
                </div>
              </>
            ) : (
              <p className="text-[#64748B] text-xs">
                {streamActive
                  ? (mpReady ? 'Nenhum rosto detectado.' : mpStatus)
                  : 'Ligue a câmera para monitorar.'}
              </p>
            )}
            <div className="p-3 rounded-lg bg-[#334155]">
              <p className="text-xs text-[#94A3B8] mb-1">Modo ativo</p>
              <p className="text-sm font-semibold text-white capitalize">
                {(liveClass?.monitoring_mode || 'full_attention').replace(/_/g, ' ')}
              </p>
            </div>
            <p className="text-[#475569] text-xs mt-2">
              Detecção anônima — nenhuma imagem sai do navegador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
