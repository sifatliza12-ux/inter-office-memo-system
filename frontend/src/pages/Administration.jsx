import NavBar from '../components/NavBar.jsx';
import DepartmentsSection from '../components/DepartmentsSection.jsx';
import UsersSection from '../components/UsersSection.jsx';
import OrganizationStatsSection from '../components/OrganizationStatsSection.jsx';

function Administration() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-gray-800">Administration</h1>

        <OrganizationStatsSection />
        <DepartmentsSection />
        <UsersSection />
      </div>
    </div>
  );
}

export default Administration;
