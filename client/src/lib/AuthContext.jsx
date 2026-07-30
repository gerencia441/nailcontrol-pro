import React, { createContext, useContext, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

// Leer la sesión guardada es síncrono, así que se hace en el inicializador del
// estado en lugar de en un efecto. Antes esto vivía en un useEffect con un
// `if (loading) return <div>Loading...</div>` que cortaba todo el árbol durante
// un commit: cada visitante del portal público veía un "Loading..." sin estilos.
function readStoredUser() {
  try {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  return null;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);

  const login = async (username, password) => {
    const response = await api.login({ username, password });
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
