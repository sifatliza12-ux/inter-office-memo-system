import { Routes, Route } from 'react-router-dom';

import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import Home from '../pages/Home.jsx';
import Administration from '../pages/Administration.jsx';
import MyMemos from '../pages/MyMemos.jsx';
import MemoForm from '../pages/MemoForm.jsx';
import MemoDetail from '../pages/MemoDetail.jsx';
import Inbox from '../pages/Inbox.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import Search from '../pages/Search.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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
      <Route
        path="/memos"
        element={
          <ProtectedRoute>
            <MyMemos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <Inbox />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <Search />
          </ProtectedRoute>
        }
      />
      <Route
        path="/memos/new"
        element={
          <ProtectedRoute>
            <MemoForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/memos/:id/edit"
        element={
          <ProtectedRoute>
            <MemoForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/memos/:id"
        element={
          <ProtectedRoute>
            <MemoDetail />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
