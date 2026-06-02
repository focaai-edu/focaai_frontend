import { useState, useRef, useEffect } from 'react';
import Layout from '../../components/Layout';

const MODE_LABELS = {
  full_attention: 'Atenção total',
  activity: 'Atividade',
  exam: 'Prova',
  break: 'Intervalo',
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Normaliza a URL: garante que termine com /video
function normalizeStreamUrl(url) {
  if (!url) return '';
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/video')) return trimmed;
  return `${trimmed}/video`;
}

// Componente isolado para o preview MJPEG — monta/desmonta o <img> sozinho
function MjpegViewer({ url, onLoad, onError }) {
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    // Força reload adicionando timestamp para evitar cache
    img.src = `${url}?t=${Date.now()}`;
  }, [url]);

  return (
    <img
      ref={imgRef}
      alt="Stream da câmera"
      onLoad={onLoad}
      onError={onError}
      className="w-full h-full object-contain"
      style={{ display: 'block' }}
    />
  );
}

// Modal de visualização da câmera
function CameraViewerModal({ camera, onClose }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const streamUrl = normalizeStreamUrl(camera.stream_url);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0F172A] rounded-2xl overflow-hidden w-full max-w-3xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#1E293B] border-b border-[#334155]">
          <div>
            <p className="text-sm font-semibold text-[#F1F5F9]">{camera.name}</p>
            {camera.location && (
              <p className="text-xs text-[#64748B]">{camera.location}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Status badge */}
            {status === 'loading' && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Conectando...
              </span>
            )}
            {status === 'ok' && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Ao vivo
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Indisponível
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#94A3B8] hover:bg-[#334155] transition-colors border-none bg-transparent cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
          {/* Sem URL cadastrada */}
          {!streamUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <svg className="w-10 h-10 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-[#475569] text-sm">Nenhuma URL configurada para esta câmera.</p>
            </div>
          )}

          {/* Overlay de loading */}
          {streamUrl && status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
              <div className="w-8 h-8 border-2 border-[#4A90D9] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#64748B] text-sm">Conectando à câmera...</p>
            </div>
          )}

          {/* Overlay de erro */}
          {streamUrl && status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <div className="w-12 h-12 rounded-xl bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="text-[#F1F5F9] text-sm font-semibold">Câmera indisponível</p>
              <p className="text-[#64748B] text-xs text-center max-w-xs">
                Não foi possível conectar ao stream. Verifique se o DroidCam está ativo e a URL está correta.
              </p>
              <p className="text-[#334155] text-xs font-mono mt-1">{streamUrl}</p>
            </div>
          )}

          {/* Stream MJPEG */}
          {streamUrl && (
            <MjpegViewer
              url={streamUrl}
              onLoad={() => setStatus('ok')}
              onError={() => setStatus('error')}
            />
          )}
        </div>

        {/* Footer com URL */}
        {streamUrl && (
          <div className="px-5 py-2.5 border-t border-[#334155] flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-[#475569] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="text-xs text-[#475569] font-mono truncate">{streamUrl}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CameraManager() {
  const [cameras, setCameras] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [viewingCamera, setViewingCamera] = useState(null);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [defaultMode, setDefaultMode] = useState('full_attention');

  const resetForm = () => {
    setName('');
    setLocation('');
    setStreamUrl('');
    setDefaultMode('full_attention');
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setEditingCamera(null);
    setShowCreate(true);
  };

  const openEdit = (cam) => {
    setName(cam.name);
    setLocation(cam.location || '');
    setStreamUrl(cam.stream_url || '');
    setDefaultMode(cam.default_mode || 'full_attention');
    setError('');
    setEditingCamera(cam);
    setShowCreate(true);
  };

  const closeModal = () => {
    setShowCreate(false);
    setEditingCamera(null);
    resetForm();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nome da câmera é obrigatório.');
      return;
    }

    const payload = {
      name: name.trim(),
      location: location.trim(),
      stream_url: streamUrl.trim(),
      default_mode: defaultMode,
      created_at: new Date().toISOString(),
    };

    if (editingCamera) {
      setCameras((prev) =>
        prev.map((cam) =>
          cam.id === editingCamera.id ? { ...cam, ...payload } : cam
        )
      );
    } else {
      const newCamera = { ...payload, id: crypto.randomUUID() };
      setCameras((prev) => [...prev, newCamera]);
    }

    closeModal();
  };

  const handleDelete = (id) => {
    if (!window.confirm('Remover esta câmera?')) return;
    setCameras((prev) => prev.filter((cam) => cam.id !== id));
  };

  return (
    <Layout role="teacher">
      {/* Page header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F1F5F9] m-0 mb-1">
            Minhas Câmeras
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#64748B] m-0">
            {cameras.length} câmera{cameras.length !== 1 ? 's' : ''} configurada{cameras.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1B4F81] text-white font-semibold text-sm hover:bg-[#164572] transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar câmera
        </button>
      </div>

      {error && !showCreate && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Camera list */}
      {cameras.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-700 dark:text-[#CBD5E1] font-medium text-sm mb-1">
            Nenhuma câmera configurada
          </p>
          <p className="text-gray-400 dark:text-[#475569] text-xs mb-4">
            Adicione a câmera da sua sala para monitorar a atenção da turma.
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-[#1B4F81] text-white text-sm font-semibold hover:bg-[#164572] transition-colors"
          >
            + Adicionar câmera
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {cameras.map((cam) => (
            <div
              key={cam.id}
              className="group bg-white dark:bg-[#1E293B] rounded-xl border border-gray-200 dark:border-[#334155] px-5 py-4 flex items-center gap-4 hover:border-[#4A90D9]/40 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => setViewingCamera(cam)}
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 dark:bg-[#334155] flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500 dark:text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 dark:text-[#F1F5F9] truncate">
                    {cam.name}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-[#334155] text-gray-500 dark:text-[#94A3B8]">
                    {MODE_LABELS[cam.default_mode] || cam.default_mode}
                  </span>
                </div>
                {cam.location && (
                  <p className="text-xs text-gray-400 dark:text-[#475569] mt-0.5 truncate">
                    {cam.location}
                  </p>
                )}
                {cam.stream_url && (
                  <p className="text-xs text-gray-400 dark:text-[#475569] mt-0.5 truncate font-mono">
                    {normalizeStreamUrl(cam.stream_url)}
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-[#475569] mt-0.5">
                  Adicionada em {formatDate(cam.created_at)}
                </p>
              </div>

              {/* Actions — stopPropagation para não abrir o viewer ao clicar nos botões */}
              <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => openEdit(cam)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#334155] text-gray-600 dark:text-[#94A3B8] text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#334155] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                  </svg>
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(cam.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/40 text-red-500 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m6 0H7" />
                  </svg>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Camera viewer modal */}
      {viewingCamera && (
        <CameraViewerModal
          camera={viewingCamera}
          onClose={() => setViewingCamera(null)}
        />
      )}

      {/* Create / Edit Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-[#1E293B] rounded-2xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#F1F5F9]">
                {editingCamera ? 'Editar câmera' : 'Adicionar câmera'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-[#64748B] hover:text-gray-600 dark:hover:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-[#334155] transition-colors border-none bg-transparent cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="cam-name" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1.5">
                  Nome da câmera <span className="text-red-400">*</span>
                </label>
                <input
                  id="cam-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Câmera — Sala A02"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] placeholder-gray-400 dark:placeholder-[#475569]"
                />
              </div>

              <div>
                <label htmlFor="cam-location" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1.5">
                  Localização <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  id="cam-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Bloco A, 1º andar"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] placeholder-gray-400 dark:placeholder-[#475569]"
                />
              </div>

              <div>
                <label htmlFor="cam-url" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1.5">
                  URL do stream <span className="text-gray-400 font-normal">(ex: http://192.168.x.x:4747)</span>
                </label>
                <input
                  id="cam-url"
                  type="text"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="http://192.168.x.x:4747"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] placeholder-gray-400 dark:placeholder-[#475569] font-mono"
                />
                <p className="text-xs text-gray-400 dark:text-[#475569] mt-1">
                  O <span className="font-mono">/video</span> será adicionado automaticamente se necessário.
                </p>
              </div>

              <div>
                <label htmlFor="cam-mode" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1.5">
                  Modo padrão de monitoramento
                </label>
                <select
                  id="cam-mode"
                  value={defaultMode}
                  onChange={(e) => setDefaultMode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-[#F1F5F9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9]"
                >
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#334155] text-gray-600 dark:text-[#94A3B8] text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-[#334155] transition-colors bg-transparent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1B4F81] text-white text-sm font-semibold hover:bg-[#164572] transition-colors"
                >
                  {editingCamera ? 'Salvar alterações' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}