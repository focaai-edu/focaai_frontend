import { useState, useRef, useCallback } from 'react';
import { MODE_THRESHOLDS, MODE_LABELS, pctColor } from '../../lib/attentionAlgo';
import api from '../../services/api';

// RoomCameraTest — testa o pipeline de detecção do backend (YuNet + solvePnP)
// com uma imagem estática do disco. Usa o mesmo endpoint que a /room usa ao vivo.

export default function RoomCameraTest() {
  const [mode, setMode]         = useState('full_attention');
  const [imgUrl, setImgUrl]     = useState(null);
  const [fileName, setFileName] = useState('');
  const [faces, setFaces]       = useState(null);
  const [aggregate, setAggregate] = useState(null);
  const [elapsed, setElapsed]   = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]       = useState('');

  const imgRef     = useRef(null);
  const overlayRef = useRef(null);
  const objectUrlRef = useRef(null);
  const pendingB64Ref = useRef(null); // base64 do arquivo atual

  // ── Desenho dos boxes ─────────────────────────────────────────────────────

  const drawBoxes = useCallback((faceList, W, H) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width = W;
    overlay.height = H;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const fontPx = Math.max(14, Math.round(H / 35));
    faceList.forEach((f, i) => {
      const { bbox, status } = f;
      const color = status === 'distracted' ? '#F59E0B' : '#22C55E';
      const px = bbox.x, py = bbox.y, pw = bbox.w, ph = bbox.h;
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = 14;
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      ctx.strokeRect(px, py, pw, ph);
      ctx.restore();
      const label = `#${i}`;
      ctx.save();
      ctx.font = `bold ${fontPx}px sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(px, py - fontPx - 6, tw + 10, fontPx + 6);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(label, px + 5, py - 5);
      ctx.restore();
    });
  }, []);

  // ── Análise via backend ───────────────────────────────────────────────────

  const analyze = useCallback(async (b64Override, modeOverride) => {
    const frame_base64 = b64Override ?? pendingB64Ref.current;
    const monitoring_mode = modeOverride ?? mode;
    if (!frame_base64) return;

    setAnalyzing(true);
    setError('');
    const t0 = performance.now();

    try {
      const res = await api.post('/api/room/analyze-frame', { frame_base64, monitoring_mode });
      const { faces: faceList = [], aggregate: agg = {}, img_w: W, img_h: H } = res.data;

      setElapsed(Math.round(performance.now() - t0));
      setFaces(faceList);
      setAggregate(agg.total > 0 ? { ...agg, pct: Math.round(agg.attentive / agg.total * 100) } : { total: 0, attentive: 0, distracted: 0, pct: 0 });

      if (W && H) drawBoxes(faceList, W, H);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Erro ao analisar.');
    } finally {
      setAnalyzing(false);
    }
  }, [mode, drawBoxes]);

  // ── Upload de arquivo ─────────────────────────────────────────────────────

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

    // Convert to base64 for backend
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(',')[1];
      pendingB64Ref.current = b64;
    };
    reader.readAsDataURL(file);
  };

  const onModeChange = (e) => {
    const m = e.target.value;
    setMode(m);
    if (pendingB64Ref.current) analyze(pendingB64Ref.current, m);
  };

  const t = MODE_THRESHOLDS[mode];

  const roomPayload = aggregate && aggregate.total > 0
    ? { class_id: '<id_da_aula>', total_faces: aggregate.total, attentive: aggregate.attentive, distracted: aggregate.distracted, attention_pct: aggregate.pct, monitoring_mode: mode }
    : null;

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F1F5F9] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Teste do algoritmo de atenção — imagem estática</h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Usa o mesmo pipeline do backend (<span className="font-mono text-[#7DB8F0]">YuNet + solvePnP</span>) que a <span className="font-mono">/room</span> usa ao vivo.
            A imagem é enviada ao servidor e os resultados de pose (yaw/pitch/roll) são retornados por rosto.
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Imagem + overlay */}
          <div className="relative bg-black rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
            {imgUrl ? (
              <div className="relative inline-block">
                <img
                  ref={imgRef}
                  src={imgUrl}
                  alt="Imagem de teste"
                  onLoad={() => { if (pendingB64Ref.current) analyze(); }}
                  className="block max-w-full h-auto"
                />
                <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} />
              </div>
            ) : (
              <p className="text-[#475569] text-sm p-10">Escolha uma imagem para começar.</p>
            )}
          </div>

          {/* Painel de resultados */}
          <div className="space-y-4">
            {/* Agregado */}
            <div className="bg-[#1E293B] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#475569] uppercase tracking-wide font-medium">Agregado</p>
                {elapsed != null && (
                  <span className="text-xs font-mono text-[#64748B]">⏱ {elapsed}ms</span>
                )}
              </div>
              {aggregate && aggregate.total > 0 ? (
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
                <p className="text-[#475569] text-xs">Nenhum rosto detectado nesta imagem.</p>
              ) : (
                <p className="text-[#475569] text-xs">Sem análise ainda.</p>
              )}
            </div>

            {/* Thresholds do modo ativo */}
            <div className="bg-[#1E293B] rounded-xl p-4">
              <p className="text-xs text-[#475569] uppercase tracking-wide font-medium mb-2">
                Thresholds — {MODE_LABELS[mode]}
              </p>
              {t ? (
                <ul className="text-xs text-[#CBD5E1] font-mono space-y-0.5">
                  <li>|yaw| &gt; {t.yaw}° → desatento</li>
                  <li>pitch &gt; {t.pitch_up}° (p/ cima) → desatento</li>
                  <li>pitch &lt; -{t.pitch_down ?? '∞'}° (p/ baixo) → {t.pitch_down === null ? 'permitido' : 'desatento'}</li>
                </ul>
              ) : (
                <p className="text-[#475569] text-xs">Modo intervalo — ninguém é marcado como desatento.</p>
              )}
            </div>

            {/* Payload room_attention_update */}
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

        {/* Tabela por rosto */}
        {faces && faces.length > 0 && (
          <div className="mt-6 bg-[#1E293B] rounded-xl p-4 overflow-x-auto">
            <p className="text-xs text-[#475569] uppercase tracking-wide font-medium mb-3">Por rosto ({faces.length})</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#64748B] text-xs border-b border-[#334155]">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">yaw</th>
                  <th className="py-2 pr-4">pitch</th>
                  <th className="py-2 pr-4">roll</th>
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
                    <td className="py-1.5 pr-4">{f.student_id ? (f.confidence * 100).toFixed(0) + '%' : '—'}</td>
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
      </div>
    </div>
  );
}
