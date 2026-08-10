import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatWorkspace from './pages/ChatWorkspace';
import { useAuth, AuthProvider } from './AuthContext';

const PrivateRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <div className="bg-gray-950 min-h-screen text-white font-sans">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <PrivateRoute>
              <ChatWorkspace />
            </PrivateRoute>
          } />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
