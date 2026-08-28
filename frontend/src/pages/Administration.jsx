import AppShell from '../components/AppShell.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import DepartmentsSection from '../components/DepartmentsSection.jsx';
import UsersSection from '../components/UsersSection.jsx';
import OrganizationStatsSection from '../components/OrganizationStatsSection.jsx';
import { PeopleIcon, BuildingIcon } from '../components/icons.jsx';

const WORKSPACE_CARDS = [
  {
    anchor: 'people-section',
    label: 'People',
    description: 'Manage user accounts, roles, and access',
    icon: PeopleIcon,
  },
  {
    anchor: 'departments-section',
    label: 'Departments',
    description: 'Organize your organizational structure',
    icon: BuildingIcon,
  },
];

const scrollToSection = (anchorId) => {
  document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function Administration() {
  return (
    <AppShell>
      <PageContainer title="Administration">
      <div className="animate-fade-in-up space-y-6">
        <OrganizationStatsSection />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {WORKSPACE_CARDS.map(({ anchor, label, description, icon: Icon }) => (
            <Card
              key={anchor}
              as="button"
              hoverable
              onClick={() => scrollToSection(anchor)}
              className="flex items-start gap-4 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-plum-50 text-plum-700">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-stone-900">{label}</p>
                <p className="mt-0.5 text-sm text-stone-500">{description}</p>
                <p className="mt-2 text-sm font-medium text-plum-700">Manage &rarr;</p>
              </div>
            </Card>
          ))}
        </div>

        <div id="departments-section">
          <DepartmentsSection />
        </div>
        <div id="people-section">
          <UsersSection />
        </div>
      </div>
      </PageContainer>
    </AppShell>
  );
}

export default Administration;
