import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Services from './pages/Services.jsx';
import Manicurists from './pages/Manicurists.jsx';
import Appointments from './pages/Appointments.jsx';
import Finances from './pages/Finances.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './lib/AuthContext.jsx';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="services" element={<AdminRoute><Services /></AdminRoute>} />
        <Route path="manicurists" element={<AdminRoute><Manicurists /></AdminRoute>} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="finances" element={<Finances />} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
      </Route>
    </Routes>
  );
}
