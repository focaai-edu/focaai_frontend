import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Health() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!health) return <div className="p-8 text-gray-500">Verificando conexão...</div>;

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold text-primary dark:text-secondary mb-6">foca.ai — Health Check</h1>
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 space-y-3 text-sm shadow-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary-light dark:text-text-secondary-dark">Status</span>
          <span className="font-semibold text-green-500">{health.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary-light dark:text-text-secondary-dark">Database</span>
          <span className="font-semibold text-green-500">{health.db}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary-light dark:text-text-secondary-dark">Users</span>
          <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{health.user_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary-light dark:text-text-secondary-dark">Worker</span>
          <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{health.worker_mode}</span>
        </div>
      </div>
    </div>
  );
}
