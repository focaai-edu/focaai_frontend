import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../../services/socket';
import api from '../../services/api';

export default function RoomCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const selectedClassIdRef = useRef(null);

  const [streamActive, setStreamActive] = useState(false);
  const [error, setError] = useState('');
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [liveClass, setLiveClass] = useState(null);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // Task 1: diagnostics state
  const [connected, setConnected] = useState(socket.connected);
  const [framesSent, setFramesSent] = useState(0);
  const [lastResponse, setLastResponse] = useState(null); // { at: number, faceCount: number }

  // Task 2: 1-second ticker for "Xs atrás"
  const [now, setNow] = useState(Date.now());

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

  // Keep latest selectedClassId reachable inside the mount-once socket handlers
  useEffect(() => { selectedClassIdRef.current = selectedClassId; }, [selectedClassId]);

  // Draw face boxes onto the overlay canvas (raw-frame coords; the scaleX(-1)
  // wrapper flips video + overlay together so boxes stay aligned).
  const drawOverlay = useCallback((faces) => {
    if (!overlayRef.current) return;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d');
    overlay.width = videoRef.current?.videoWidth || 1280;
    overlay.height = videoRef.current?.videoHeight || 720;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    faces.forEach((face) => {
      const { bbox } = face;
      if (!bbox) return;
      const isIdentified = face.student_id !== null && face.student_id !== undefined;
      const color = isIdentified ? '#22C55E' : '#F59E0B';

      // Thick, glowing box so a detection is unmistakable on screen
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
      ctx.restore();

      const label = isIdentified
        ? `${face.student_name || face.student_id} (${Math.round((face.confidence || 0) * 100)}%)`
        : 'Não identificado';
      ctx.font = 'bold 20px Inter, sans-serif';
      const tw = ctx.measureText(label).width;
      const ly = Math.max(0, bbox.y - 28);
      ctx.fillStyle = color;
      ctx.fillRect(bbox.x, ly, tw + 12, 26);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(label, bbox.x + 6, ly + 19);
    });
  }, []);

  // Mount-once: connection tracking + faces handler + auto (re)join on connect.
  // The handler is registered a single time with a class-id ref, avoiding the
  // stale-closure / "socket.off removes all" races that made detections only
  // appear after a manual page refresh.
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const cid = selectedClassIdRef.current;
      if (cid) socket.emit('join_class', { class_id: cid });
    };
    const onDisconnect = () => setConnected(false);
    const onFaces = (data) => {
      if (data.class_id !== selectedClassIdRef.current) return;
      const faces = data.faces || [];
      setDetectedFaces(faces);
      drawOverlay(faces);
      setLastResponse({ at: Date.now(), faceCount: faces.length });
      console.log('[room] faces_identified:', faces.length, 'faces', faces);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('faces_identified', onFaces);
    setConnected(socket.connected);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('faces_identified', onFaces);
    };
  }, [drawOverlay]);

  // Task 2: 1-second ticker
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
      else if (err.name === 'NotFoundError') setError('Nenhuma câmera USB encontrada.');
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

  // Join the class room when a class is selected. If the socket isn't connected
  // yet, the onConnect handler above performs the join once connected.
  useEffect(() => {
    if (!selectedClassId) return;
    if (!socket.connected) socket.connect();
    else socket.emit('join_class', { class_id: selectedClassId });
    return () => {
      socket.emit('leave_class', { class_id: selectedClassId });
    };
  }, [selectedClassId]);

  // Task 1: capture effect — connection-aware, deps include `connected`
  useEffect(() => {
    if (!streamActive || !selectedClassId || !connected) return;
    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      socket.emit('room_frame', { class_id: selectedClassId, frame_base64: canvas.toDataURL('image/jpeg', 0.7) });
      setFramesSent((n) => n + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [streamActive, selectedClassId, connected]);

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
      {/* Header */}
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

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-black">
          {/* Hidden capture canvas — NOT flipped, sends raw frame to backend */}
          <canvas ref={canvasRef} className="hidden" />

          <div className="relative w-full h-full">
            {/* Task 2: Diagnostics HUD — outside the flipped wrapper so text reads normally */}
            {streamActive && (
              <div className="absolute top-3 left-3 z-10 bg-black/60 text-white text-xs font-mono rounded-md px-3 py-2 space-y-0.5 pointer-events-none">
                <div>{connected ? '🟢 Socket conectado' : '🔴 Socket desconectado'}</div>
                <div>Frames enviados: {framesSent}</div>
                <div>
                  {lastResponse
                    ? `Última resposta: ${Math.max(0, Math.round((now - lastResponse.at) / 1000))}s atrás · ${lastResponse.faceCount} rosto(s)`
                    : 'Aguardando resposta do servidor...'}
                </div>
              </div>
            )}

            {/* Detection badge — big, pulsing cue (like the student camera's live feedback) */}
            {streamActive && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                {detectedFaces.length > 0 ? (
                  <div className="flex items-center gap-2 bg-green-500/90 text-white font-semibold text-sm rounded-full px-4 py-1.5 shadow-lg animate-pulse">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-white" />
                    {detectedFaces.length} rosto(s) detectado(s)
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-black/60 text-gray-300 text-sm rounded-full px-4 py-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
                    Procurando rostos...
                  </div>
                )}
              </div>
            )}

            {/* Task 3: ONE always-mounted video + overlay inside a single flipped wrapper.
                The video stays mounted (ref stable) and is hidden via CSS when inactive, so the
                srcObject assigned in startCamera survives the streamActive toggle (no black screen).
                Both video and overlay share the scaleX(-1) flip → un-mirrored display, aligned boxes. */}
            <div className="w-full h-full" style={{ transform: 'scaleX(-1)' }}>
              <video
                ref={videoRef}
                className={streamActive ? 'w-full h-full object-contain' : 'hidden'}
                playsInline muted autoPlay
              />
              {streamActive && (
                <canvas ref={overlayRef} className="absolute inset-0 w-full h-full" />
              )}
            </div>

            {/* Placeholder when stream is off — outside the flip so icon/text read normally */}
            {!streamActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[#64748B] text-sm">Câmera desligada. Clique em "Ligar Câmera" para iniciar.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-[300px] bg-[#1E293B] p-4 border-l border-[#334155] overflow-y-auto">
          <h3 className="text-base font-semibold mb-1 text-white">Alunos Detectados ({detectedFaces.length})</h3>
          <p className="text-[#64748B] text-xs mb-4">
            Se &quot;Frames enviados&quot; sobe mas a resposta fica em 0 rostos, verifique luz, cadastro facial e pesos do detector.
          </p>
          {detectedFaces.length === 0 ? (
            <p className="text-[#64748B] text-xs">Nenhum rosto detectado.</p>
          ) : (
            <div className="space-y-2">
              {detectedFaces.map((face, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-[#334155] border-l-3"
                  style={{ borderLeftColor: face.student_id ? '#22C55E' : '#9CA3AF', borderLeftWidth: '3px' }}
                >
                  <p className="text-sm font-semibold m-0 mb-0.5 text-white">{face.student_name || 'Não identificado'}</p>
                  <p className="text-xs text-[#94A3B8] m-0">
                    {face.student_id ? `Confiança: ${Math.round(face.confidence * 100)}%` : 'Cadastro facial necessário'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
