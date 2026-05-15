import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Services from './pages/Services.jsx';
import Manicurists from './pages/Manicurists.jsx';
import Appointments from './pages/Appointments.jsx';
import Finances from './pages/Finances.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="services" element={<Services />} />
        <Route path="manicurists" element={<Manicurists />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="finances" element={<Finances />} />
      </Route>
    </Routes>
  );
}
