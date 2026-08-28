import NavBar from '../components/NavBar.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import DepartmentsSection from '../components/DepartmentsSection.jsx';
import UsersSection from '../components/UsersSection.jsx';
import OrganizationStatsSection from '../components/OrganizationStatsSection.jsx';

function Administration() {
  return (
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <PageContainer title="Administration">
        <OrganizationStatsSection />
        <DepartmentsSection />
        <UsersSection />
      </PageContainer>
    </div>
  );
}

export default Administration;
