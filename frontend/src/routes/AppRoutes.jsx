import { Routes, Route } from 'react-router-dom';

function Placeholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-800">
        Inter-Office Memo Management System
      </h1>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
    </Routes>
  );
}

export default AppRoutes;
