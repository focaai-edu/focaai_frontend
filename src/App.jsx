import { Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherClassLive from './pages/teacher/ClassLive';
import TeacherClassReport from './pages/teacher/ClassReport';
import StudentDashboard from './pages/student/Dashboard';
import StudentClassLive from './pages/student/ClassLive';
import StudentClassReview from './pages/student/ClassReview';
import RoomCamera from './pages/room/RoomCamera';
import RoomCameraTest from './pages/room/RoomCameraTest';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/teacher/dashboard" element={
          <ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>
        } />
        <Route path="/teacher/classes/:id/live" element={
          <ProtectedRoute role="teacher"><TeacherClassLive /></ProtectedRoute>
        } />
        <Route path="/teacher/classes/:id/report" element={
          <ProtectedRoute role="teacher"><TeacherClassReport /></ProtectedRoute>
        } />
        <Route path="/student/dashboard" element={
          <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
        } />
        <Route path="/student/classes/:id/live" element={
          <ProtectedRoute role="student"><StudentClassLive /></ProtectedRoute>
        } />
        <Route path="/student/classes/:id/review" element={
          <ProtectedRoute role="student"><StudentClassReview /></ProtectedRoute>
        } />
        <Route path="/room" element={
          <ProtectedRoute role="teacher"><RoomCamera /></ProtectedRoute>
        } />
        {/* Banco de testes do algoritmo de atenção com imagem estática (dev) */}
        <Route path="/room-test" element={<RoomCameraTest />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/dashboard`} replace />;
}
