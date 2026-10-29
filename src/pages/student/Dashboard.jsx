import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import Layout from '../../components/Layout';
import api from '../../services/api';
import LoadError from '../../components/LoadError';
import { isLoadFailure } from '../../lib/loadError';

// Uma aula que começa aparece sem recarregar a página (#5, F34).
const REFRESH_MS = 15000;

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [liveClasses, setLiveClasses] = useState([]);
  const [scheduledClasses, setScheduledClasses] = useState([]);
  const [endedClasses, setEndedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const [liveRes, scheduledRes, endedRes] = await Promise.all([
        api.get('/api/classes', { params: { status: 'live' } }),
        api.get('/api/classes', { params: { status: 'scheduled' } }),
        api.get('/api/classes', { params: { status: 'ended' } }),
      ]);
      setLiveClasses(liveRes.data.classes);
      setScheduledClasses(scheduledRes.data.classes);
      setEndedClasses(endedRes.data.classes);
      setLoaded(true);
      setLoadFailed(false);
    } catch (err) {
      // Sem resposta ou 5xx: erro visível. Se uma carga anterior deu certo, a
      // lista na tela continua e a próxima recarga tenta de novo (ver `loaded`).
      if (isLoadFailure(err)) setLoadFailed(true);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchClasses();
    const timer = setInterval(fetchClasses, REFRESH_MS);
    window.addEventListener('focus', fetchClasses);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', fetchClasses);
    };
  }, [fetchClasses]);

  if (loading) {
    return <Layout role="student"><p className="text-gray-500 dark:text-text-muted-dark">Carregando...</p></Layout>;
  }

  const cardBase = "bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm";

  if (loadFailed && !loaded) {
    return <Layout role="student"><LoadError onRetry={() => { setLoading(true); fetchClasses(); }} /></Layout>;
  }

  return (
    <Layout role="student">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-text-primary-dark mb-6">Minhas Aulas</h1>

      {/* Live */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 text-green-600 dark:text-green-400 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          Ao Vivo Agora
        </h2>
        {liveClasses.length === 0 ? (
          <div className={`py-10 text-center ${cardBase}`}>
            <p className="text-gray-500 dark:text-text-muted-dark text-sm">Nenhuma aula ao vivo no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {liveClasses.map(cls => (
              <div key={cls.id} className={`${cardBase} border-2 border-green-400 dark:border-green-600 p-5 flex justify-between items-center gap-4`}>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-text-primary-dark m-0 mb-1">{cls.title}</h3>
                  {cls.description && <p className="text-sm text-gray-500 dark:text-text-muted-dark m-0 truncate">{cls.description}</p>}
                </div>
                <button
                  onClick={() => navigate(`/student/classes/${cls.id}/live`)}
                  className="flex-shrink-0 px-6 py-2.5 rounded-lg bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors"
                >
                  Entrar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Scheduled */}
      {scheduledClasses.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3 text-amber-600 dark:text-amber-400">Agendadas</h2>
          <div className="space-y-2">
            {scheduledClasses.map(cls => (
              <div key={cls.id} className={`${cardBase} p-4 flex items-center gap-3`}>
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-text-primary-dark m-0">{cls.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="text-base font-semibold mb-3 text-gray-500 dark:text-text-muted-dark">Histórico</h2>
        {endedClasses.length === 0 ? (
          <div className={`py-10 text-center ${cardBase}`}>
            <p className="text-gray-500 dark:text-text-muted-dark text-sm">Nenhuma aula no histórico ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {endedClasses.map(cls => (
              <div key={cls.id} className={`${cardBase} p-4 flex justify-between items-center gap-4`}>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-text-primary-dark m-0 mb-1">{cls.title}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-text-secondary-dark">Encerrada</span>
                </div>
                <button
                  onClick={() => navigate(`/student/classes/${cls.id}/review`)}
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition-colors"
                >
                  Revisar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
