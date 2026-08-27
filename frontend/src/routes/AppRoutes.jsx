import { Routes, Route } from 'react-router-dom';

import Login from '../pages/Login.jsx';
import Home from '../pages/Home.jsx';
import Administration from '../pages/Administration.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <Administration />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
