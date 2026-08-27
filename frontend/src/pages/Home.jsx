import { useAuth } from '../context/AuthContext.jsx';
import NavBar from '../components/NavBar.jsx';

function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-gray-800">Inter-Office Memo Management System</h1>
        <p className="text-gray-600">
          Signed in as {user?.name} ({user?.email})
          {user?.organizationId?.name ? ` — ${user.organizationId.name}` : ''}
        </p>
      </div>
    </div>
  );
}

export default Home;
