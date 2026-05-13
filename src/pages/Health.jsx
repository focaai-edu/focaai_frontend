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
      <h1 className="text-2xl font-bold text-[#1B4F81] mb-6">foca.ai — Health Check</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Status</span>
          <span className="font-semibold text-green-500">{health.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Database</span>
          <span className="font-semibold text-green-500">{health.db}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Users</span>
          <span className="font-semibold">{health.user_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Worker</span>
          <span className="font-semibold">{health.worker_mode}</span>
        </div>
      </div>
    </div>
  );
}
