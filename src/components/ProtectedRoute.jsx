import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-light dark:bg-bg-dark">
        <p className="text-slate-500 dark:text-slate-400">Carregando...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    const redirectPath = user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}
