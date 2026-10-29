import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import socket, { connectSocket } from '../../services/socket';
import api from '../../services/api';
import { useLiveClassExitGuard } from '../../hooks/useLiveClassExitGuard';
import { useAudioChunks } from '../../hooks/useAudioChunks';
import Dialog from '../../components/Dialog';
import { MODE_LABELS, pctColor } from '../../lib/attentionAlgo';
import { STATUS_COLORS } from '../../lib/colors';

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_CAMERAS_KEY = 'foca_cameras';
const LS_ACTIVE_KEY  = 'foca_active_camera_id';

// Frame capture interval sent to backend for detection (ms)
// Um frame por segundo e um por vez: o próximo só sai depois da resposta
// (faces_identified) ou de um error, ou após FRAME_TIMEOUT_MS sem resposta (#51).
const FRAME_INTERVAL_MS = 1000;
const FRAME_TIMEOUT_MS  = 5000;

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

// Motivo do getUserMedia em pt-BR; o caso comum é a webcam presa por outro navegador (#47).
function webcamErrorMessage(err) {
  switch (err?.name) {
    case 'NotReadableError':
    case 'TrackStartError':
      return 'A câmera está em uso por outro aplicativo ou navegador. Feche-o e clique em Tentar de novo.';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permissão da câmera negada. Libere o acesso à câmera no navegador e clique em Tentar de novo.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera encontrada. Conecte uma webcam e clique em Tentar de novo.';
    default:
      return 'Não foi possível abrir a câmera. Clique em Tentar de novo.';
  }
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
      <Dialog titleId="camera-form-title" onClose={onClose} className="bg-surface-dark rounded-xl border border-border-dark p-6 max-w-md w-full shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="camera-form-title" className="text-lg font-semibold text-text-primary-dark">
            {camera ? 'Editar câmera' : 'Adicionar câmera'}
          </h2>
          <button type="button" aria-label="Fechar janela" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted-dark hover:bg-slate-700 transition-colors border-none bg-transparent cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 text-red-400 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Câmera — Sala A02"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-dark bg-bg-dark text-text-primary-dark text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Localização <span className="text-slate-500 font-normal">(opcional)</span></label>
            <input value={location} onChange={e => setLoc(e.target.value)} placeholder="Ex: Bloco A, 1º andar"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-dark bg-bg-dark text-text-primary-dark text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de fonte</label>
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
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-border-dark bg-transparent text-text-muted-dark hover:bg-slate-700'
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
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                URL do stream <span className="text-slate-500 font-normal">(ex: 192.168.x.x:4747)</span>
              </label>
              <input value={streamUrl} onChange={e => setUrl(e.target.value)} placeholder="192.168.x.x:4747"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border-dark bg-bg-dark text-text-primary-dark text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary placeholder-slate-500 font-mono" />
              <p className="text-xs text-slate-500 mt-1">O <span className="font-mono">http://</span> e <span className="font-mono">/video</span> são adicionados automaticamente.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Modo padrão</label>
            <select value={mode} onChange={e => setMode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-dark bg-bg-dark text-text-primary-dark text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary">
              {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border-dark text-text-secondary-dark text-sm font-medium cursor-pointer hover:bg-slate-700 transition-colors bg-transparent">
              Cancelar
            </button>
            <button type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
              {camera ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Dialog>
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
  const [roomNotice, setRoomNotice]             = useState('');
  const navigate = useNavigate();
  // Com uma aula ao vivo selecionada, o professor está na sala dela (RN25):
  // sair pergunta se é para encerrar a aula também (#9, CA7).
  const { requestLeave, dialog: leaveDialog } = useLiveClassExitGuard({ classId: selectedClassId, active: Boolean(liveClass) });

  // Monitoring
  const [monitoring, setMonitoring] = useState(false);
  const [streamOk, setStreamOk]     = useState(false);
  const [webcamError, setWebcamError] = useState('');
  const [webcamAttempt, setWebcamAttempt] = useState(0);
  const [aggregate, setAggregate]   = useState(null);
  const [debugPose, setDebugPose]   = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);

  // Refs
  const imgRef        = useRef(null);
  const overlayRef    = useRef(null);
  const captureRef    = useRef(null);
  const intervalRef   = useRef(null);
  const frameSentAtRef = useRef(null); // envio do frame ainda sem resposta (#51)
  const currentModeRef       = useRef('full_attention');
  const selectedClassIdRef   = useRef(null);
  const transcriptEndRef     = useRef(null);
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

  const loadLiveClasses = useCallback(() => {
    api.get('/api/classes', { params: { status: 'live' } })
      .then(res => {
        const list = res.data.classes || [];
        setAvailableClasses(list);
        if (list.length > 0) { setSelectedClassId(list[0].id); setLiveClass(list[0]); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadLiveClasses(); }, [loadLiveClasses]);

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
    if (!socket.connected) connectSocket();
    else socket.emit('join_class', { class_id: selectedClassId });
    return () => { socket.emit('leave_class', { class_id: selectedClassId }); };
  }, [selectedClassId]);

  // ── Webcam source ────────────────────────────────────────────────────────

  useEffect(() => { isWebcamRef.current = isWebcam; }, [isWebcam]);

  useEffect(() => {
    // Sem aula ao vivo selecionada não há o que monitorar: a câmera fica desligada (#9, CA9).
    if (!isWebcam || !selectedClassId) {
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
    setWebcamError('');
    // Uma stream que chega depois da troca de aula/câmera não pode ficar presa à webcam (#47).
    let cancelled = false;
    // 1280x720 como ideal: rostos distantes ficam pequenos demais em 640x480 para o YuNet.
    // Sem exact/min, a webcam fraca abre na maior resolução que tiver (#56).
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        webcamStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStreamOk(true);
      })
      .catch(err => {
        if (cancelled) return;
        setStreamOk(false);
        setWebcamError(webcamErrorMessage(err));
      });
    return () => {
      cancelled = true;
      webcamStreamRef.current?.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    };
  }, [isWebcam, activeCameraId, selectedClassId, webcamAttempt]);

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
      const color = dist ? STATUS_COLORS.distracted : STATUS_COLORS.attentive;
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
      // Zero rostos também é resposta: null fica só para antes da primeira análise (#53).
      setAggregate({ total, attentive: att, distracted: dist, pct });
    };
    socket.on('room_attention_update', onRoomAttention);
    return () => socket.off('room_attention_update', onRoomAttention);
  }, []);

  useEffect(() => {
    const onFacesIdentified = (data) => {
      if (selectedClassIdRef.current && data.class_id !== selectedClassIdRef.current) return;
      frameSentAtRef.current = null;
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
    const onServerError = () => { frameSentAtRef.current = null; };
    socket.on('faces_identified', onFacesIdentified);
    socket.on('error', onServerError);
    return () => {
      socket.off('faces_identified', onFacesIdentified);
      socket.off('error', onServerError);
    };
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
    if (frameSentAtRef.current !== null && Date.now() - frameSentAtRef.current < FRAME_TIMEOUT_MS) return;

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
    frameSentAtRef.current = Date.now();
    socket.emit('room_frame', { class_id: cid, frame_base64 });
  }, []);

  useEffect(() => {
    if (!monitoring) return;

    setAggregate(null);
    setDebugPose(null);
    frameSentAtRef.current = null;

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
    };
  }, [monitoring, captureAndSend]);

  // Áudio da aula: mesmo hook da tela do professor (RF14, #4). Grava com a sala
  // aberta; ao fechar, o trecho em curso é enviado antes de liberar o microfone.
  const audio = useAudioChunks(selectedClassId, { enabled: monitoring });
  const micActive = audio.status === 'recording';

  // ── Room open / close ─────────────────────────────────────────────────────

  const handleOpenRoom = () => setMonitoring(true);

  const handleCloseRoom = useCallback(() => setMonitoring(false), []);

  // Aula encerrada em outra aba (dashboard) ou pelo servidor: fecha a sala,
  // desliga câmera e microfone e recarrega as aulas ao vivo (#9, F12).
  useEffect(() => {
    const onClassEnded = (data) => {
      if (data.class_id !== selectedClassIdRef.current) return;
      handleCloseRoom();
      setRoomNotice('A aula foi encerrada.');
      setSelectedClassId(null);
      setLiveClass(null);
      setAvailableClasses([]);
      loadLiveClasses();
    };
    socket.on('class_ended', onClassEnded);
    return () => socket.off('class_ended', onClassEnded);
  }, [handleCloseRoom, loadLiveClasses]);

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
    <div className="h-screen overflow-hidden bg-bg-dark text-text-primary-dark flex flex-col">

      {/* Header */}
      <header className="px-5 py-3 bg-primary flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/teacher/dashboard')}
            className="px-3 py-1.5 rounded-lg border border-white/30 bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
          >
            ← Painel
          </button>
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
            type="button"
            onClick={() => setShowSettings(s => !s)}
            title="Configurações"
            aria-label="Configurações"
            aria-expanded={showSettings}
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
              onClick={() => requestLeave(handleCloseRoom)}
              className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
            >
              Fechar Sala
            </button>
          )}
        </div>
      </header>

      {roomNotice && (
        <div role="status" className="px-5 py-2 bg-slate-700 text-text-primary-dark text-xs text-center flex-shrink-0">
          {roomNotice}
        </div>
      )}

      {availableClasses.length === 0 && (
        <div className="px-5 py-2 bg-amber-900/40 text-amber-300 text-xs text-center flex-shrink-0">
          Nenhuma aula ao vivo. Inicie uma aula no Dashboard do Professor para poder monitorar.
        </div>
      )}

      {/* Barra de modos */}
      {liveClass && (
        <div className="px-5 py-2 bg-surface-dark border-b border-border-dark flex items-center gap-2 overflow-x-auto flex-shrink-0">
          <span className="text-xs text-text-muted-dark mr-1 flex-shrink-0">Modo:</span>
          {Object.entries(MODE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => changeMode(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border-none cursor-pointer transition-colors ${
                (liveClass.monitoring_mode || 'full_attention') === key
                  ? 'bg-secondary text-white'
                  : 'bg-slate-700 text-text-secondary-dark hover:bg-slate-600'
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
              <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-text-muted-dark text-sm">Nenhuma câmera configurada.</p>
              <button onClick={() => setShowSettings(true)}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
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
                  <div role="status">
                    {audio.status === 'offline' ? '🔴 Sem conexão — o áudio não está sendo enviado'
                      : micActive ? '🎙️ Gravando' : '🔇 Sem microfone'}
                  </div>
                  {aggregate && <div>Rostos: {aggregate.total} · Atentos: {aggregate.attentive} · {aggregate.pct}%</div>}
                  {debugPose && <div>yaw:{debugPose.yaw}° pitch:{debugPose.pitch}°</div>}
                </div>
              )}

              {monitoring && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  {liveClass?.monitoring_mode === 'break' ? (
                    <div className="flex items-center gap-2 bg-amber-500/90 text-white font-semibold text-sm rounded-full px-4 py-1.5 shadow-sm">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-white" />
                      Intervalo — detecção pausada
                    </div>
                  ) : aggregate?.total === 0 ? (
                    <div className="flex items-center gap-2 bg-black/60 text-gray-200 text-sm rounded-full px-4 py-1.5">
                      Nenhum rosto detectado
                    </div>
                  ) : aggregate ? (
                    <div className={`flex items-center gap-2 ${pctColor(aggregate.pct).bg} text-white font-semibold text-sm rounded-full px-4 py-1.5 shadow-sm`}>
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
                  <p className="text-text-primary-dark text-sm font-semibold">Câmera indisponível</p>
                  {isWebcam ? (
                    <p role="alert" className="text-text-muted-dark text-xs text-center max-w-xs">{webcamError || 'Abrindo a webcam...'}</p>
                  ) : (
                    <>
                      <p className="text-text-muted-dark text-xs">Verifique se o DroidCam está ativo e na mesma rede.</p>
                      <p className="text-slate-500 text-xs font-mono">{streamUrl}</p>
                    </>
                  )}
                  <button
                    onClick={() => {
                      if (isWebcam) {
                        setWebcamAttempt(n => n + 1);
                      } else if (imgRef.current && proxyUrl) {
                        setStreamOk(false);
                        imgRef.current.src = `${proxyUrl}&t=${Date.now()}`;
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors mt-1">
                    {isWebcam ? 'Tentar de novo' : 'Reconectar'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Transcription panel */}
        <div className="w-[300px] bg-surface-dark border-l border-border-dark flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-border-dark flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-text-primary-dark">Transcrição</h3>
            {aggregate && (
              <span className={`text-xs font-semibold tabular-nums ${pctColor(aggregate.pct).text}`}>
                {aggregate.attentive}/{aggregate.total} · {aggregate.pct}%
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {transcriptions.length === 0 ? (
              <p className="text-slate-500 text-xs">
                {!selectedClassId ? 'Selecione uma aula ao vivo.' : 'Aguardando transcrição da aula...'}
              </p>
            ) : (
              transcriptions.map((t, i) => (
                <div key={i}>
                  <span className="text-[10px] text-slate-500 font-mono">{t.time}</span>
                  <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{t.content}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Settings overlay */}
        {showSettings && (
          <Dialog titleId="room-settings-title" onClose={() => setShowSettings(false)} className="absolute inset-y-0 right-0 w-[300px] bg-surface-dark border-l border-border-dark z-50 flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark flex-shrink-0">
              <h3 id="room-settings-title" className="text-sm font-semibold text-text-primary-dark">Configurações</h3>
              <button
                type="button"
                aria-label="Fechar configurações"
                onClick={() => setShowSettings(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted-dark hover:bg-slate-700 transition-colors border-none bg-transparent cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">

              {/* Attention stats */}
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-medium">Atenção da Turma</p>
                {aggregate?.total === 0 ? (
                  <p className="text-slate-400 text-xs">Nenhum rosto detectado.</p>
                ) : aggregate ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-slate-700">
                      <p className={`text-2xl font-bold ${pctColor(aggregate.pct).text}`}>{aggregate.pct}%</p>
                      <p className="text-xs text-text-secondary-dark">atenção média</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-slate-700 text-center">
                        <p className="text-xl font-bold text-green-400">{aggregate.attentive}</p>
                        <p className="text-xs text-text-secondary-dark">atentos</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-700 text-center">
                        <p className="text-xl font-bold text-amber-400">{aggregate.distracted}</p>
                        <p className="text-xs text-text-secondary-dark">desatentos</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs">
                    {!activeCamera ? 'Configure uma câmera.' :
                     !streamOk ? 'Câmera indisponível.' :
                     !monitoring ? 'Clique em "Abrir Sala".' :
                     'Procurando rostos...'}
                  </p>
                )}
              </div>

              {/* Current mode */}
              <div>
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide font-medium">Modo ativo</p>
                <p className="text-sm font-semibold text-white">
                  {MODE_LABELS[liveClass?.monitoring_mode || 'full_attention']}
                </p>
              </div>

              {/* Cameras */}
              <div>
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-medium">Câmeras</p>
                <div className="space-y-1.5">
                  {cameras.map(cam => (
                    <div
                      key={cam.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors ${cam.id === activeCameraId ? 'bg-secondary/20 border border-secondary/40' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                      {/* Selecionar a câmera é um botão: funciona com Enter/Espaço (#16). */}
                      <button
                        type="button"
                        aria-pressed={cam.id === activeCameraId}
                        aria-label={`Usar câmera ${cam.name}`}
                        onClick={() => { if (cam.id !== activeCamera?.id) { setActiveCamId(cam.id); setStreamOk(false); } }}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cam.id === activeCameraId ? 'bg-secondary' : 'bg-slate-500'}`} />
                        <span className="text-xs text-text-primary-dark truncate flex-1">{cam.name}</span>
                      </button>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" aria-label={`Editar câmera ${cam.name}`} onClick={() => { setEditingCam(cam); setShowForm(true); }}
                          className="w-6 h-6 flex items-center justify-center rounded text-text-muted-dark hover:text-text-secondary-dark hover:bg-slate-600 transition-colors border-none bg-transparent cursor-pointer">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                        <button type="button" aria-label={`Remover câmera ${cam.name}`} onClick={() => handleDeleteCam(cam.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-red-500/60 hover:text-red-400 hover:bg-slate-600 transition-colors border-none bg-transparent cursor-pointer">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m6 0H7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setEditingCam(null); setShowForm(true); }}
                    className="w-full text-xs text-secondary hover:text-secondary/80 py-1.5 transition-colors bg-transparent border-none cursor-pointer">
                    + Adicionar câmera
                  </button>
                </div>
              </div>

              <p className="text-slate-500 text-xs">Frames processados no servidor — detecção anônima por padrão.</p>
            </div>
          </Dialog>
        )}
      </div>

      {showForm && (
        <CameraFormModal
          camera={editingCam}
          onSave={handleSaveCam}
          onClose={() => { setShowForm(false); setEditingCam(null); }}
        />
      )}
      {leaveDialog}
    </div>
  );
}
