import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../../services/socket';
import api from '../../services/api';
import { MODE_LABELS, pctColor } from '../../lib/attentionAlgo';

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_CAMERAS_KEY = 'foca_cameras';
const LS_ACTIVE_KEY  = 'foca_active_camera_id';

// Frame capture interval sent to backend for detection (ms)
const FRAME_INTERVAL_MS = 3000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadCameras() {
  try { return JSON.parse(localStorage.getItem(LS_CAMERAS_KEY) || '[]'); }
  catch { return []; }
}
function saveCameras(cameras) {
  localStorage.setItem(LS_CAMERAS_KEY, JSON.stringify(cameras));
}
function normalizeStreamUrl(url) {
  if (!url) return '';
  let s = url.trim().replace(/\/+$/, '');
  if (!s.startsWith('http://') && !s.startsWith('https://')) s = `http://${s}`;
  if (s.endsWith('/video')) return s;
  return `${s}/video`;
}

// ── Camera Form Modal ─────────────────────────────────────────────────────────

function CameraFormModal({ camera, onSave, onClose }) {
  const [name, setName]       = useState(camera?.name || '');
  const [location, setLoc]    = useState(camera?.location || '');
  const [type, setType]       = useState(camera?.stream_url === '__webcam__' ? 'webcam' : 'mjpeg');
  const [streamUrl, setUrl]   = useState(camera?.stream_url === '__webcam__' ? '' : (camera?.stream_url || ''));
  const [mode, setMode]       = useState(camera?.default_mode || 'full_attention');
  const [error, setError]     = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Nome obrigatório.'); return; }
    if (type === 'mjpeg' && !streamUrl.trim()) { setError('URL do stream obrigatória para câmera IP.'); return; }
    onSave({
      name: name.trim(),
      location: location.trim(),
      stream_url: type === 'webcam' ? '__webcam__' : streamUrl.trim(),
      default_mode: mode,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1E293B] rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#F1F5F9]">
            {camera ? 'Editar câmera' : 'Adicionar câmera'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#334155] transition-colors border-none bg-transparent cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 text-red-400 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Nome *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Câmera — Sala A02"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Localização <span className="text-[#475569] font-normal">(opcional)</span></label>
            <input value={location} onChange={e => setLoc(e.target.value)} placeholder="Ex: Bloco A, 1º andar"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#CBD5E1] mb-2">Tipo de fonte</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'mjpeg', label: 'Câmera IP / MJPEG', icon: '📡' },
                { value: 'webcam', label: 'Webcam do computador', icon: '💻' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    type === opt.value
                      ? 'border-[#4A90D9] bg-[#4A90D9]/10 text-[#7DB8F0]'
                      : 'border-[#334155] bg-transparent text-[#64748B] hover:bg-[#334155]'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {type === 'mjpeg' && (
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">
                URL do stream <span className="text-[#475569] font-normal">(ex: 192.168.x.x:4747)</span>
              </label>
              <input value={streamUrl} onChange={e => setUrl(e.target.value)} placeholder="192.168.x.x:4747"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] placeholder-[#475569] font-mono" />
              <p className="text-xs text-[#475569] mt-1">O <span className="font-mono">http://</span> e <span className="font-mono">/video</span> são adicionados automaticamente.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Modo padrão</label>
            <select value={mode} onChange={e => setMode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#334155] bg-[#0F172A] text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9]">
              {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#334155] text-[#94A3B8] text-sm font-medium cursor-pointer hover:bg-[#334155] transition-colors bg-transparent">
              Cancelar
            </button>
            <button type="submit"
              className="px-4 py-2 rounded-lg bg-[#1B4F81] text-white text-sm font-semibold hover:bg-[#164572] transition-colors">
              {camera ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RoomCamera() {
  // Camera config (localStorage)
  const [cameras, setCameras]           = useState(loadCameras);
  const [activeCameraId, setActiveCamId] = useState(() => localStorage.getItem(LS_ACTIVE_KEY) || null);
  const [showForm, setShowForm]         = useState(false);
  const [editingCam, setEditingCam]     = useState(null);

  // Class / socket
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassId, setSelectedClassId]   = useState(null);
  const [liveClass, setLiveClass]               = useState(null);
  const [connected, setConnected]               = useState(socket.connected);

  // Monitoring
  const [monitoring, setMonitoring] = useState(false);
  const [streamOk, setStreamOk]     = useState(false);
  const [aggregate, setAggregate]   = useState(null);
  const [debugPose, setDebugPose]   = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [micActive, setMicActive] = useState(false);

  // Refs
  const imgRef        = useRef(null);
  const overlayRef    = useRef(null);
  const captureRef    = useRef(null);
  const intervalRef   = useRef(null);
  const currentModeRef       = useRef('full_attention');
  const selectedClassIdRef   = useRef(null);
  const transcriptEndRef     = useRef(null);
  const micStreamRef         = useRef(null);
  const recorderRef          = useRef(null);
  const videoRef             = useRef(null);
  const webcamStreamRef      = useRef(null);
  const isWebcamRef          = useRef(false);

  // Derived
  const activeCamera = cameras.find(c => c.id === activeCameraId) || cameras[0] || null;
  const isWebcam     = activeCamera?.stream_url === '__webcam__';
  const streamUrl    = isWebcam ? '' : normalizeStreamUrl(activeCamera?.stream_url || '');

  const proxyUrl = streamUrl
    ? `http://localhost:5000/api/camera/stream?url=${encodeURIComponent(streamUrl)}`
    : '';

  useEffect(() => {
    if (!proxyUrl || !imgRef.current) return;
    setStreamOk(false);
    imgRef.current.src = `${proxyUrl}&t=${Date.now()}`;
  }, [proxyUrl]);

  // ── localStorage persistence ──────────────────────────────────────────────

  useEffect(() => { saveCameras(cameras); }, [cameras]);
  useEffect(() => {
    if (activeCameraId) localStorage.setItem(LS_ACTIVE_KEY, activeCameraId);
    else localStorage.removeItem(LS_ACTIVE_KEY);
  }, [activeCameraId]);

  useEffect(() => {
    if (!activeCameraId && cameras.length > 0) setActiveCamId(cameras[0].id);
    if (activeCameraId && !cameras.find(c => c.id === activeCameraId))
      setActiveCamId(cameras[0]?.id || null);
  }, [cameras, activeCameraId]);

  // ── Load live classes ─────────────────────────────────────────────────────

  useEffect(() => {
    api.get('/api/classes', { params: { status: 'live' } })
      .then(res => {
        const list = res.data.classes || [];
        setAvailableClasses(list);
        if (list.length > 0) { setSelectedClassId(list[0].id); setLiveClass(list[0]); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { selectedClassIdRef.current = selectedClassId; }, [selectedClassId]);
  useEffect(() => {
    if (liveClass?.monitoring_mode) currentModeRef.current = liveClass.monitoring_mode;
  }, [liveClass]);

  // ── Socket ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onConnect    = () => { setConnected(true); const cid = selectedClassIdRef.current; if (cid) socket.emit('join_class', { class_id: cid }); };
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); };
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    if (!socket.connected) socket.connect();
    else socket.emit('join_class', { class_id: selectedClassId });
    return () => { socket.emit('leave_class', { class_id: selectedClassId }); };
  }, [selectedClassId]);

  // ── Webcam source ────────────────────────────────────────────────────────

  useEffect(() => { isWebcamRef.current = isWebcam; }, [isWebcam]);

  useEffect(() => {
    if (!isWebcam) {
      webcamStreamRef.current?.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
      return;
    }
    const existing = webcamStreamRef.current;
    if (existing && existing.getTracks().some(t => t.readyState === 'live')) {
      if (videoRef.current && videoRef.current.srcObject !== existing) {
        videoRef.current.srcObject = existing;
        videoRef.current.play().catch(() => {});
      }
      setStreamOk(true);
      return;
    }
    setStreamOk(false);
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        webcamStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStreamOk(true);
      })
      .catch(() => setStreamOk(false));
    return () => {
      webcamStreamRef.current?.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    };
  }, [isWebcam, activeCameraId]);

  // ── Transcription ─────────────────────────────────────────────────────────

  useEffect(() => {
    const onTranscription = (data) => {
      if (selectedClassIdRef.current && data.class_id !== selectedClassIdRef.current) return;
      setTranscriptions(prev => [...prev, {
        content: data.content,
        time: new Date(data.timestamp || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }]);
    };
    socket.on('new_transcription', onTranscription);
    return () => socket.off('new_transcription', onTranscription);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptions]);

  // ── Monitoring mode sync ──────────────────────────────────────────────────

  useEffect(() => {
    const onModeChanged = (data) => {
      if (selectedClassIdRef.current && data.class_id !== selectedClassIdRef.current) return;
      currentModeRef.current = data.mode;
      setLiveClass(prev => prev ? { ...prev, monitoring_mode: data.mode } : prev);
    };
    socket.on('monitoring_mode_changed', onModeChanged);
    return () => socket.off('monitoring_mode_changed', onModeChanged);
  }, []);

  const changeMode = useCallback((mode) => {
    currentModeRef.current = mode;
    setLiveClass(prev => prev ? { ...prev, monitoring_mode: mode } : prev);
    const cid = selectedClassIdRef.current;
    if (cid) socket.emit('change_monitoring_mode', { class_id: cid, mode });
  }, []);

  // ── Drawing ───────────────────────────────────────────────────────────────

  const drawFaceBoxes = useCallback((faceBoxes, frameW, frameH) => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    // Canvas covers the full container; image uses object-contain → may have
    // black bars. Compute the actual displayed image rect inside the container.
    const cW = overlay.clientWidth  || frameW;
    const cH = overlay.clientHeight || frameH;
    const scale   = Math.min(cW / frameW, cH / frameH);
    const dispW   = frameW * scale;
    const dispH   = frameH * scale;
    const offsetX = (cW - dispW) / 2;
    const offsetY = (cH - dispH) / 2;

    overlay.width  = cW;
    overlay.height = cH;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, cW, cH);

    faceBoxes.forEach(({ x, y, w, h, distracted: dist }) => {
      const color = dist ? '#F59E0B' : '#22C55E';
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = 14;
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      // x,y,w,h are 0-1 normalised relative to the frame
      ctx.strokeRect(offsetX + x * dispW, offsetY + y * dispH, w * dispW, h * dispH);
      ctx.restore();
    });
  }, []);

  // ── Backend socket events (detection results) ─────────────────────────────

  useEffect(() => {
    const onRoomAttention = (data) => {
      if (selectedClassIdRef.current && data.class_id !== selectedClassIdRef.current) return;
      const total = data.total_faces || 0;
      const att   = data.attentive   || 0;
      const dist  = data.distracted  || 0;
      const pct   = total > 0 ? Math.round(att / total * 100) : 0;
      setAggregate(total > 0 ? { total, attentive: att, distracted: dist, pct } : null);
    };
    socket.on('room_attention_update', onRoomAttention);
    return () => socket.off('room_attention_update', onRoomAttention);
  }, []);

  useEffect(() => {
    const onFacesIdentified = (data) => {
      if (selectedClassIdRef.current && data.class_id !== selectedClassIdRef.current) return;
      const { faces = [], img_w: W, img_h: H } = data;
      if (!W || !H) return;

      // Normalize pixel bbox to 0-1 for drawFaceBoxes
      const boxes = faces.map(f => ({
        x: f.bbox.x / W,
        y: f.bbox.y / H,
        w: f.bbox.w / W,
        h: f.bbox.h / H,
        distracted: f.status === 'distracted',
      }));
      drawFaceBoxes(boxes, W, H);

      if (faces.length > 0 && faces[0].yaw !== undefined) {
        setDebugPose({ yaw: Number(faces[0].yaw).toFixed(1), pitch: Number(faces[0].pitch).toFixed(1) });
      } else {
        setDebugPose(null);
      }
    };
    socket.on('faces_identified', onFacesIdentified);
    return () => socket.off('faces_identified', onFacesIdentified);
  }, [drawFaceBoxes]);

  // ── Frame capture + send ──────────────────────────────────────────────────

  const captureAndSend = useCallback(() => {
    if (currentModeRef.current === 'break') {
      if (overlayRef.current) {
        const ctx = overlayRef.current.getContext('2d');
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
      setAggregate(null);
      setDebugPose(null);
      return;
    }

    const cid = selectedClassIdRef.current;
    if (!cid) return;

    const source = isWebcamRef.current ? videoRef.current : imgRef.current;
    if (!source) return;
    if (isWebcamRef.current) {
      if (!source.srcObject || source.readyState < 2) return;
    } else {
      if (!source.complete || source.naturalWidth === 0) return;
    }

    const capture = captureRef.current;
    if (!capture) return;

    const W = (source.videoWidth  || source.naturalWidth)  || 640;
    const H = (source.videoHeight || source.naturalHeight) || 480;
    capture.width  = W;
    capture.height = H;
    capture.getContext('2d').drawImage(source, 0, 0, W, H);

    const frame_base64 = capture.toDataURL('image/jpeg', 0.75).split(',')[1];
    socket.emit('room_frame', { class_id: cid, frame_base64 });
  }, []);

  useEffect(() => {
    if (!monitoring) return;

    setAggregate(null);
    setDebugPose(null);

    // Send first frame immediately, then on interval
    captureAndSend();
    intervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
      setAggregate(null);
      setDebugPose(null);
      if (overlayRef.current) {
        const ctx = overlayRef.current.getContext('2d');
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
      if (recorderRef.current) { recorderRef.current.stop(); recorderRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
      setMicActive(false);
    };
  }, [monitoring, captureAndSend]);

  // ── Room open / close ─────────────────────────────────────────────────────

  const handleOpenRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      setMicActive(true);

      function recordChunk() {
        if (!micStreamRef.current) return;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm';
        const recorder = new MediaRecorder(micStreamRef.current, { mimeType });
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          if (chunks.length > 0 && selectedClassIdRef.current && micStreamRef.current) {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
              socket.emit('audio_chunk', { class_id: selectedClassIdRef.current, audio: reader.result.split(',')[1] });
            };
            reader.readAsDataURL(blob);
          }
          recordChunk();
        };
        recorder.start();
        recorderRef.current = recorder;
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000);
      }

      recordChunk();
    } catch (err) {
      console.warn('[RoomCamera] Microfone indisponível:', err.message);
      setMicActive(false);
    }
    setMonitoring(true);
  };

  const handleCloseRoom = () => {
    if (recorderRef.current) { recorderRef.current.stop(); recorderRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setMicActive(false);
    setMonitoring(false);
  };

  // ── Camera CRUD ───────────────────────────────────────────────────────────

  const handleSaveCam = (payload) => {
    if (editingCam) {
      setCameras(prev => prev.map(c => c.id === editingCam.id ? { ...c, ...payload } : c));
    } else {
      const cam = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      setCameras(prev => [...prev, cam]);
      setActiveCamId(cam.id);
    }
    setShowForm(false);
    setEditingCam(null);
  };

  const handleDeleteCam = (id) => {
    if (!window.confirm('Remover esta câmera?')) return;
    setCameras(prev => prev.filter(c => c.id !== id));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen overflow-hidden bg-[#0F172A] text-[#F1F5F9] flex flex-col">

      {/* Header */}
      <header className="px-5 py-3 bg-[#1B4F81] flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold m-0">Câmera da Sala</h1>
          {liveClass && (
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-md">{liveClass.title}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {availableClasses.length > 1 && (
            <select
              value={selectedClassId || ''}
              onChange={e => { setSelectedClassId(+e.target.value); setLiveClass(availableClasses.find(c => c.id === +e.target.value)); }}
              className="text-xs rounded-lg border border-white/20 bg-white/10 text-white px-2.5 py-1.5 focus:outline-none"
            >
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}

          <button
            onClick={() => setShowSettings(s => !s)}
            title="Configurações"
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border-none cursor-pointer ${showSettings ? 'bg-white/20 text-white' : 'text-white/70 bg-transparent hover:bg-white/10'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {!monitoring ? (
            <button
              onClick={handleOpenRoom}
              disabled={!activeCamera || !streamOk || availableClasses.length === 0}
              className="px-4 py-2 rounded-lg bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Abrir Sala
            </button>
          ) : (
            <button
              onClick={handleCloseRoom}
              className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
            >
              Fechar Sala
            </button>
          )}
        </div>
      </header>

      {availableClasses.length === 0 && (
        <div className="px-5 py-2 bg-amber-900/40 text-amber-300 text-xs text-center flex-shrink-0">
          Nenhuma aula ao vivo. Inicie uma aula no Dashboard do Professor para poder monitorar.
        </div>
      )}

      {/* Barra de modos */}
      {liveClass && (
        <div className="px-5 py-2 bg-[#1E293B] border-b border-[#334155] flex items-center gap-2 overflow-x-auto flex-shrink-0">
          <span className="text-xs text-[#64748B] mr-1 flex-shrink-0">Modo:</span>
          {Object.entries(MODE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => changeMode(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border-none cursor-pointer transition-colors ${
                (liveClass.monitoring_mode || 'full_attention') === key
                  ? 'bg-[#4A90D9] text-white'
                  : 'bg-[#334155] text-[#94A3B8] hover:bg-[#3D4F68]'
              }`}
            >
              {label}
            </button>
          ))}
          {liveClass.monitoring_mode === 'break' && (
            <span className="text-xs text-amber-400 ml-1 flex-shrink-0 whitespace-nowrap">Detecção pausada</span>
          )}
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">

        {/* Stream area */}
        <div className="flex-1 relative bg-black min-w-0">
          <canvas ref={captureRef} className="hidden" />

          {!activeCamera && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <svg className="w-12 h-12 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-[#64748B] text-sm">Nenhuma câmera configurada.</p>
              <button onClick={() => setShowSettings(true)}
                className="px-4 py-2 rounded-lg bg-[#1B4F81] text-white text-sm font-semibold hover:bg-[#164572] transition-colors">
                + Configurar câmera
              </button>
            </div>
          )}

          {activeCamera && (isWebcam || streamUrl) && (
            <>
              {isWebcam ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  ref={imgRef}
                  alt="Stream da câmera"
                  crossOrigin="anonymous"
                  onLoad={() => setStreamOk(true)}
                  onError={() => { setStreamOk(false); setMonitoring(false); }}
                  className="w-full h-full object-contain"
                />
              )}

              {monitoring && (
                <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              )}

              {monitoring && (
                <div className="absolute top-3 left-3 z-10 bg-black/60 text-white text-xs font-mono rounded-md px-3 py-2 space-y-0.5 pointer-events-none">
                  <div>{connected ? '🟢 Socket' : '🔴 Socket desconectado'}</div>
                  <div>🟢 Backend (YuNet)</div>
                  <div>{micActive ? '🎙️ Mic ativo' : '🔇 Sem microfone'}</div>
                  {aggregate && <div>Rostos: {aggregate.total} · Atentos: {aggregate.attentive} · {aggregate.pct}%</div>}
                  {debugPose && <div>yaw:{debugPose.yaw}° pitch:{debugPose.pitch}°</div>}
                </div>
              )}

              {monitoring && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  {liveClass?.monitoring_mode === 'break' ? (
                    <div className="flex items-center gap-2 bg-amber-500/90 text-white font-semibold text-sm rounded-full px-4 py-1.5 shadow-lg">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-white" />
                      Intervalo — detecção pausada
                    </div>
                  ) : aggregate ? (
                    <div className={`flex items-center gap-2 ${pctColor(aggregate.pct).bg} text-white font-semibold text-sm rounded-full px-4 py-1.5 shadow-lg`}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-white" />
                      {aggregate.attentive}/{aggregate.total} atentos · {aggregate.pct}%
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-black/60 text-gray-300 text-sm rounded-full px-4 py-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400 animate-pulse" />
                      Analisando frame...
                    </div>
                  )}
                </div>
              )}

              {!streamOk && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                  <p className="text-[#F1F5F9] text-sm font-semibold">Câmera indisponível</p>
                  {isWebcam ? (
                    <p className="text-[#64748B] text-xs">Verifique as permissões da webcam no navegador.</p>
                  ) : (
                    <>
                      <p className="text-[#64748B] text-xs">Verifique se o DroidCam está ativo e na mesma rede.</p>
                      <p className="text-[#334155] text-xs font-mono">{streamUrl}</p>
                    </>
                  )}
                  <button
                    onClick={() => {
                      if (isWebcam) {
                        setStreamOk(false);
                        navigator.mediaDevices.getUserMedia({ video: true })
                          .then(stream => {
                            webcamStreamRef.current = stream;
                            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
                            setStreamOk(true);
                          })
                          .catch(() => {});
                      } else if (imgRef.current && proxyUrl) {
                        setStreamOk(false);
                        imgRef.current.src = `${proxyUrl}&t=${Date.now()}`;
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#1B4F81] text-white text-xs font-semibold hover:bg-[#164572] transition-colors mt-1">
                    Reconectar
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Transcription panel */}
        <div className="w-[300px] bg-[#1E293B] border-l border-[#334155] flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-[#334155] flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-[#F1F5F9]">Transcrição</h3>
            {aggregate && (
              <span className={`text-xs font-semibold tabular-nums ${pctColor(aggregate.pct).text}`}>
                {aggregate.attentive}/{aggregate.total} · {aggregate.pct}%
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {transcriptions.length === 0 ? (
              <p className="text-[#475569] text-xs">
                {!selectedClassId ? 'Selecione uma aula ao vivo.' : 'Aguardando transcrição da aula...'}
              </p>
            ) : (
              transcriptions.map((t, i) => (
                <div key={i}>
                  <span className="text-[10px] text-[#475569] font-mono">{t.time}</span>
                  <p className="text-sm text-[#CBD5E1] mt-0.5 leading-relaxed">{t.content}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Settings overlay */}
        {showSettings && (
          <div className="absolute inset-y-0 right-0 w-[300px] bg-[#1E293B] border-l border-[#334155] z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#334155] flex-shrink-0">
              <h3 className="text-sm font-semibold text-[#F1F5F9]">Configurações</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#334155] transition-colors border-none bg-transparent cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">

              {/* Attention stats */}
              <div>
                <p className="text-xs text-[#475569] mb-2 uppercase tracking-wide font-medium">Atenção da Turma</p>
                {aggregate ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-[#334155]">
                      <p className={`text-2xl font-bold ${pctColor(aggregate.pct).text}`}>{aggregate.pct}%</p>
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
                  </div>
                ) : (
                  <p className="text-[#475569] text-xs">
                    {!activeCamera ? 'Configure uma câmera.' :
                     !streamOk ? 'Câmera indisponível.' :
                     !monitoring ? 'Clique em "Abrir Sala".' :
                     'Procurando rostos...'}
                  </p>
                )}
              </div>

              {/* Current mode */}
              <div>
                <p className="text-xs text-[#475569] mb-1 uppercase tracking-wide font-medium">Modo ativo</p>
                <p className="text-sm font-semibold text-white">
                  {MODE_LABELS[liveClass?.monitoring_mode || 'full_attention']}
                </p>
              </div>

              {/* Cameras */}
              <div>
                <p className="text-xs text-[#475569] mb-2 uppercase tracking-wide font-medium">Câmeras</p>
                <div className="space-y-1.5">
                  {cameras.map(cam => (
                    <div
                      key={cam.id}
                      onClick={() => { setActiveCamId(cam.id); setStreamOk(false); }}
                      className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${cam.id === activeCameraId ? 'bg-[#4A90D9]/20 border border-[#4A90D9]/40' : 'bg-[#334155] hover:bg-[#3D4F68]'}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cam.id === activeCameraId ? 'bg-[#4A90D9]' : 'bg-[#475569]'}`} />
                      <span className="text-xs text-[#F1F5F9] truncate flex-1">{cam.name}</span>
                      <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingCam(cam); setShowForm(true); }}
                          className="w-6 h-6 flex items-center justify-center rounded text-[#64748B] hover:text-[#94A3B8] hover:bg-[#475569] transition-colors border-none bg-transparent cursor-pointer">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteCam(cam.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-red-500/60 hover:text-red-400 hover:bg-[#475569] transition-colors border-none bg-transparent cursor-pointer">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m6 0H7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setEditingCam(null); setShowForm(true); }}
                    className="w-full text-xs text-[#4A90D9] hover:text-[#7DB8F0] py-1.5 transition-colors bg-transparent border-none cursor-pointer">
                    + Adicionar câmera
                  </button>
                </div>
              </div>

              <p className="text-[#334155] text-xs">Frames processados no servidor — detecção anônima por padrão.</p>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <CameraFormModal
          camera={editingCam}
          onSave={handleSaveCam}
          onClose={() => { setShowForm(false); setEditingCam(null); }}
        />
      )}
    </div>
  );
}
