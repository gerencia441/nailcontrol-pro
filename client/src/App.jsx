import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientHistory from './pages/ClientHistory.jsx';
import Services from './pages/Services.jsx';
import Manicurists from './pages/Manicurists.jsx';
import Appointments from './pages/Appointments.jsx';
import Finances from './pages/Finances.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';
import Login from './pages/Login.jsx';
import BookingPortal from './pages/public/BookingPortal.jsx';
import { useAuth } from './lib/AuthContext.jsx';
import { isBookingHost } from './lib/publicHost.js';

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
  // En el subdominio de reservas la raíz muestra el portal público; en el
  // dominio administrativo mantiene el comportamiento de siempre.
  const portal = isBookingHost();

  return (
    <Routes>
      {/* Rutas públicas: siempre fuera de ProtectedRoute y de Layout */}
      <Route path="/reservar" element={<BookingPortal />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          portal ? (
            <BookingPortal />
          ) : (
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          )
        }
      />

      {/* Ruta de layout sin path: los hijos conservan sus rutas relativas */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientHistory />} />
        <Route path="services" element={<AdminRoute><Services /></AdminRoute>} />
        <Route path="especialistas" element={<AdminRoute><Manicurists /></AdminRoute>} />
        {/* URL anterior a renombrar "manicuristas" a "especialistas" */}
        <Route path="manicurists" element={<Navigate to="/especialistas" replace />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="finances" element={<Finances />} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
      </Route>

      {/* Antes una ruta desconocida renderizaba una página en blanco */}
      <Route path="*" element={<Navigate to={portal ? '/reservar' : '/dashboard'} replace />} />
    </Routes>
  );
}
