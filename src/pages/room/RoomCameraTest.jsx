import { useState, useRef, useCallback } from 'react';
import { MODE_THRESHOLDS, MODE_LABELS, pctColor } from '../../lib/attentionAlgo';
import api from '../../services/api';

// ── Parameter definitions ─────────────────────────────────────────────────────

// Threshold defaults per mode — mirrors backend _MODE_THRESHOLDS.
// pitch_down: 90 = desabilitado (nunca atingível, pois pitch ∈ [-90, 90]).
const MODE_THRESHOLD_DEFAULTS = {
  full_attention: { yaw_threshold: 35, pitch_up: 30, pitch_down: 25, eye_ratio_threshold: 0.25 },
  activity:       { yaw_threshold: 35, pitch_up: 35, pitch_down: 90, eye_ratio_threshold: 0.25 },
  exam:           { yaw_threshold: 30, pitch_up: 30, pitch_down: 90, eye_ratio_threshold: 0.25 },
  break:          { yaw_threshold: 35, pitch_up: 30, pitch_down: 25, eye_ratio_threshold: 0.25 },
};

const DEFAULT_PARAMS = {
  // Detection
  score_threshold: 0.75,
  nms_threshold: 0.3,
  top_k: 100,
  // Pose estimation
  yaw_scale: 45,
  pitch_ref: 0.55,
  pitch_scale: 150,
  // Attention thresholds (initialized to full_attention defaults)
  ...MODE_THRESHOLD_DEFAULTS.full_attention,
  eye_ratio_threshold: 0.25,
};

const PARAM_DEFS = [
  {
    section: 'Detecção YuNet',
    items: [
      {
        key: 'score_threshold',
        label: 'Score Threshold',
        desc: 'Confiança mínima para aceitar um rosto. ↓ detecta mais rostos (risco de falsos positivos) · ↑ menos rostos, maior precisão.',
        min: 0.3, max: 1.0, step: 0.05, fmt: v => v.toFixed(2),
      },
      {
        key: 'nms_threshold',
        label: 'NMS Threshold',
        desc: 'Sobreposição máxima entre caixas antes de eliminar a menos confiante. ↓ suprime mais duplicatas · ↑ permite mais sobreposição.',
        min: 0.1, max: 0.9, step: 0.05, fmt: v => v.toFixed(2),
      },
      {
        key: 'top_k',
        label: 'Top K',
        desc: 'Número máximo de candidatos avaliados antes do NMS. Deve ser ≥ número de rostos esperados na cena.',
        min: 10, max: 500, step: 10, isInt: true, fmt: v => String(v),
      },
    ],
  },
  {
    section: 'Limiares de Atenção',
    items: [
      {
        key: 'yaw_threshold',
        label: 'Yaw máximo (°)',
        desc: 'Rotação horizontal máxima da cabeça antes de marcar desatento. Yaw = virar a cabeça para os lados.',
        min: 5, max: 90, step: 1, isInt: true, fmt: v => `${v}°`,
      },
      {
        key: 'pitch_up',
        label: 'Pitch p/ cima máx. (°)',
        desc: 'Inclinação máxima para cima antes de marcar desatento. Pitch positivo = olhando para o teto.',
        min: 5, max: 90, step: 1, isInt: true, fmt: v => `${v}°`,
      },
      {
        key: 'pitch_down',
        label: 'Pitch p/ baixo máx. (°)',
        desc: 'Inclinação máxima para baixo antes de marcar desatento. Pitch negativo = olhando para o chão ou celular.',
        min: 5, max: 90, step: 1, isInt: true, fmt: v => `${v}°`,
      },
      {
        key: 'eye_ratio_threshold',
        label: 'Razão inter-ocular mín.',
        desc: 'Razão mínima entre distância dos olhos e largura do rosto. Rosto frontal ≈ 0.45 · 45° virado ≈ 0.25 · perfil total ≈ 0.05. Abaixo deste valor → desatento (rosto de perfil).',
        min: 0.05, max: 0.50, step: 0.01, fmt: v => v.toFixed(2),
      },
    ],
  },
  {
    section: 'Estimativa de Pose',
    items: [
      {
        key: 'yaw_scale',
        label: 'Escala Yaw',
        desc: 'Fator de escala para converter deslocamento do nariz em graus de yaw. ↑ amplifica pequenas rotações.',
        min: 10, max: 90, step: 1, isInt: true, fmt: v => String(v),
      },
      {
        key: 'pitch_ref',
        label: 'Referência de Pitch',
        desc: 'Posição esperada do nariz no span olho→boca para rosto frontal (0 = nível dos olhos, 1 = nível da boca). Típico: 0.55.',
        min: 0.30, max: 0.80, step: 0.01, fmt: v => v.toFixed(2),
      },
      {
        key: 'pitch_scale',
        label: 'Escala Pitch',
        desc: 'Fator de escala para converter desvio do nariz em graus de pitch. ↑ amplifica pequenas inclinações verticais.',
        min: 50, max: 300, step: 5, isInt: true, fmt: v => String(v),
      },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoomCameraTest() {
  const [mode, setMode]           = useState('full_attention');
  const [imgUrl, setImgUrl]       = useState(null);
  const [fileName, setFileName]   = useState('');
  const [faces, setFaces]         = useState(null);
  const [aggregate, setAggregate] = useState(null);
  const [elapsed, setElapsed]     = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]         = useState('');
  const [params, setParams]       = useState(DEFAULT_PARAMS);
  const [showParams, setShowParams] = useState(true);

  const imgRef        = useRef(null);
  const overlayRef    = useRef(null);
  const objectUrlRef  = useRef(null);
  const pendingB64Ref = useRef(null);
  const paramsRef     = useRef(DEFAULT_PARAMS);
  const debounceRef   = useRef(null);

  // ── Draw boxes ────────────────────────────────────────────────────────────

  const drawBoxes = useCallback((faceList, W, H) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width  = W;
    overlay.height = H;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const fontPx = Math.max(13, Math.round(H / 40));
    faceList.forEach((f, i) => {
      const { bbox, status } = f;
      const color = status === 'distracted' ? '#F59E0B' : '#22C55E';
      const { x: px, y: py, w: pw, h: ph } = bbox;
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.strokeRect(px, py, pw, ph);
      ctx.restore();
      const label = `#${i}`;
      ctx.save();
      ctx.font = `bold ${fontPx}px sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(px, py - fontPx - 4, tw + 8, fontPx + 4);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(label, px + 4, py - 3);
      ctx.restore();
    });
  }, []);

  // ── Analyze ───────────────────────────────────────────────────────────────

  const analyze = useCallback(async (b64Override, modeOverride, paramsOverride) => {
    const frame_base64    = b64Override    ?? pendingB64Ref.current;
    const monitoring_mode = modeOverride   ?? mode;
    const effectiveParams = paramsOverride ?? paramsRef.current;
    if (!frame_base64) return;

    setAnalyzing(true);
    setError('');
    const t0 = performance.now();
    try {
      const res = await api.post('/api/room/analyze-frame', {
        frame_base64,
        monitoring_mode,
        params: effectiveParams,
      });
      const { faces: fl = [], aggregate: agg = {}, img_w: W, img_h: H } = res.data;
      setElapsed(Math.round(performance.now() - t0));
      setFaces(fl);
      setAggregate(
        agg.total > 0
          ? { ...agg, pct: Math.round((agg.attentive / agg.total) * 100) }
          : { total: 0, attentive: 0, distracted: 0, pct: 0 }
      );
      if (W && H) drawBoxes(fl, W, H);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Erro ao analisar.');
    } finally {
      setAnalyzing(false);
    }
  }, [mode, drawBoxes]);

  // ── Param update with debounced re-analyze ────────────────────────────────

  const updateParam = useCallback((key, raw) => {
    const def = PARAM_DEFS.flatMap(s => s.items).find(p => p.key === key);
    const value = def?.isInt ? parseInt(raw) : parseFloat(raw);
    const next = { ...paramsRef.current, [key]: value };
    paramsRef.current = next;
    setParams(next);
    if (!pendingB64Ref.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      analyze(pendingB64Ref.current, undefined, next);
    }, 400);
  }, [analyze]);

  // ── File upload ───────────────────────────────────────────────────────────

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setFileName(file.name);
    setFaces(null);
    setAggregate(null);
    setElapsed(null);
    setError('');
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
    setImgUrl(url);
    const reader = new FileReader();
    reader.onload = () => { pendingB64Ref.current = reader.result.split(',')[1]; };
    reader.readAsDataURL(file);
  };

  const onModeChange = (e) => {
    const m = e.target.value;
    setMode(m);
    // Reset threshold sliders to this mode's defaults
    const modeDefaults = MODE_THRESHOLD_DEFAULTS[m] || MODE_THRESHOLD_DEFAULTS.full_attention;
    const next = { ...paramsRef.current, ...modeDefaults };
    paramsRef.current = next;
    setParams(next);
    if (pendingB64Ref.current) analyze(pendingB64Ref.current, m, next);
  };

  const t = MODE_THRESHOLDS[mode];
  const roomPayload = aggregate?.total > 0
    ? { class_id: '<id_da_aula>', total_faces: aggregate.total, attentive: aggregate.attentive, distracted: aggregate.distracted, attention_pct: aggregate.pct, monitoring_mode: mode }
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F1F5F9] p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Teste do algoritmo de atenção — imagem estática</h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Pipeline backend: <span className="font-mono text-[#7DB8F0]">YuNet + estimativa geométrica</span>.
            Ajuste os parâmetros e clique em <strong>Analisar</strong> para ver o impacto em tempo real.
          </p>
          <div className="mt-2 text-xs font-mono text-green-400">🟢 Backend (YuNet)</div>
        </header>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <label className="px-4 py-2 rounded-lg bg-[#1B4F81] text-white text-sm font-semibold cursor-pointer hover:bg-[#164572] transition-colors">
            Escolher imagem
            <input type="file" accept="image/*" onChange={onFile} className="hidden" />
          </label>
          {fileName && <span className="text-xs text-[#94A3B8] font-mono truncate max-w-[240px]">{fileName}</span>}

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-[#475569] uppercase tracking-wide">Modo</span>
            <select
              value={mode}
              onChange={onModeChange}
              className="text-sm rounded-lg border border-[#334155] bg-[#0F172A] text-[#F1F5F9] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30"
            >
              {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <button
            onClick={() => analyze()}
            disabled={!imgUrl || analyzing}
            className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {analyzing ? 'Analisando...' : 'Analisar'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/20 text-red-400 text-sm">{error}</div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* Image + overlay */}
          <div className="relative bg-black rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
            {imgUrl ? (
              <div className="relative inline-block">
                <img ref={imgRef} src={imgUrl} alt="Imagem de teste" className="block max-w-full h-auto" />
                <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
              </div>
            ) : (
              <p className="text-[#475569] text-sm p-10">Escolha uma imagem para começar.</p>
            )}
          </div>

          {/* Results panel */}
          <div className="space-y-4">
            <div className="bg-[#1E293B] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#475569] uppercase tracking-wide font-medium">Agregado</p>
                {elapsed != null && <span className="text-xs font-mono text-[#64748B]">⏱ {elapsed}ms</span>}
              </div>
              {aggregate?.total > 0 ? (
                <>
                  <p className={`text-3xl font-bold ${pctColor(aggregate.pct).text}`}>{aggregate.pct}%</p>
                  <p className="text-xs text-[#94A3B8] mb-3">atenção média</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-[#334155]">
                      <p className="text-lg font-bold text-[#F1F5F9]">{aggregate.total}</p>
                      <p className="text-[10px] text-[#94A3B8]">rostos</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#334155]">
                      <p className="text-lg font-bold text-green-400">{aggregate.attentive}</p>
                      <p className="text-[10px] text-[#94A3B8]">atentos</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#334155]">
                      <p className="text-lg font-bold text-amber-400">{aggregate.distracted}</p>
                      <p className="text-[10px] text-[#94A3B8]">desatentos</p>
                    </div>
                  </div>
                </>
              ) : aggregate ? (
                <p className="text-[#475569] text-xs">Nenhum rosto detectado.</p>
              ) : (
                <p className="text-[#475569] text-xs">Sem análise ainda.</p>
              )}
            </div>

            <div className="bg-[#1E293B] rounded-xl p-4">
              <p className="text-xs text-[#475569] uppercase tracking-wide font-medium mb-2">
                Thresholds ativos — {MODE_LABELS[mode]}
              </p>
              <ul className="text-xs text-[#CBD5E1] font-mono space-y-0.5">
                <li>|yaw| &gt; {params.yaw_threshold}° → desatento</li>
                <li>pitch &gt; {params.pitch_up}° (p/ cima) → desatento</li>
                {t?.pitch_down !== null
                  ? <li>pitch &lt; -{params.pitch_down}° (p/ baixo) → desatento</li>
                  : <li className="text-[#475569]">pitch p/ baixo → permitido</li>}
              </ul>
            </div>

            {roomPayload && (
              <div className="bg-[#1E293B] rounded-xl p-4">
                <p className="text-xs text-[#475569] uppercase tracking-wide font-medium mb-2">
                  Payload <span className="font-mono">room_attention_update</span>
                </p>
                <pre className="text-[11px] text-[#7DB8F0] font-mono overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(roomPayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Per-face table */}
        {faces?.length > 0 && (
          <div className="mt-6 bg-[#1E293B] rounded-xl p-4 overflow-x-auto">
            <p className="text-xs text-[#475569] uppercase tracking-wide font-medium mb-3">Por rosto ({faces.length})</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#64748B] text-xs border-b border-[#334155]">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">yaw</th>
                  <th className="py-2 pr-4">pitch</th>
                  <th className="py-2 pr-4">roll</th>
                  <th className="py-2 pr-4" title="eye_dist / face_width — abaixo do limiar = perfil">razão ocular</th>
                  <th className="py-2 pr-4">confiança</th>
                  <th className="py-2 pr-4">aluno</th>
                  <th className="py-2">status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {faces.map((f, i) => (
                  <tr key={i} className="border-b border-[#334155]/50">
                    <td className="py-1.5 pr-4 text-[#94A3B8]">{i}</td>
                    <td className="py-1.5 pr-4">{Number(f.yaw).toFixed(1)}°</td>
                    <td className="py-1.5 pr-4">{Number(f.pitch).toFixed(1)}°</td>
                    <td className="py-1.5 pr-4">{Number(f.roll).toFixed(1)}°</td>
                    <td className={`py-1.5 pr-4 font-bold ${f.eye_ratio < params.eye_ratio_threshold ? 'text-amber-400' : 'text-[#94A3B8]'}`}>
                      {f.eye_ratio?.toFixed(2) ?? '—'}
                    </td>
                    <td className="py-1.5 pr-4">{f.student_id ? `${(f.confidence * 100).toFixed(0)}%` : '—'}</td>
                    <td className="py-1.5 pr-4 text-[#7DB8F0]">{f.student_name || <span className="text-[#475569]">anônimo</span>}</td>
                    <td className={`py-1.5 font-semibold ${f.status === 'distracted' ? 'text-amber-400' : 'text-green-400'}`}>
                      {f.status === 'distracted' ? 'desatento' : 'atento'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Parameters panel */}
        <div className="mt-6">
          <button
            onClick={() => setShowParams(s => !s)}
            className="flex items-center gap-2 text-sm font-semibold text-[#94A3B8] hover:text-[#F1F5F9] transition-colors mb-4 cursor-pointer bg-transparent border-none"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showParams ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Parâmetros de detecção
            <span className="text-xs text-[#475569] font-normal ml-1">
              — alterações re-analisam automaticamente
            </span>
          </button>

          {showParams && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PARAM_DEFS.map(section => (
                <div key={section.section} className="bg-[#1E293B] rounded-xl p-4">
                  <p className="text-xs text-[#475569] uppercase tracking-wide font-semibold mb-4">
                    {section.section}
                  </p>
                  <div className="space-y-5">
                    {section.items.map(def => (
                      <div key={def.key}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-[#CBD5E1]">{def.label}</label>
                          <span className="text-sm font-mono font-bold text-[#4A90D9]">
                            {def.fmt(params[def.key])}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={def.min}
                          max={def.max}
                          step={def.step}
                          value={params[def.key]}
                          onChange={e => updateParam(def.key, e.target.value)}
                          className="w-full accent-[#4A90D9] cursor-pointer h-1.5"
                        />
                        <p className="text-[11px] text-[#475569] mt-1.5 leading-snug">{def.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
