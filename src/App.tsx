import { Loader2 } from 'lucide-react';
import { AppProvider, useApp } from './AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { TrainingList } from './pages/TrainingList';
import { ModulePage } from './pages/ModulePage';
import { AssessmentWorkspace } from './pages/AssessmentWorkspace';
import { Results } from './pages/Results';
import { MyAssessments } from './pages/MyAssessments';
import { MyProgress } from './pages/MyProgress';
import { TrainingHistory } from './pages/TrainingHistory';
import { Settings } from './pages/Settings';
import { TrainerDashboard } from './pages/TrainerDashboard';
import { TrainingMaterials } from './pages/TrainingMaterials';
import { UserManagement } from './pages/UserManagement';
import { Login } from './pages/Login';

function AppContent() {
  const { view, mode } = useApp();
  const { isStaff } = useAuth();

  let page;
  switch (view) {
    case 'dashboard':
      page = <Dashboard />;
      break;
    case 'training':
      page = <TrainingList />;
      break;
    case 'module':
      page = <ModulePage />;
      break;
    case 'assessment':
      page = <AssessmentWorkspace />;
      break;
    case 'results':
      page = <Results />;
      break;
    case 'my-assessments':
      page = <MyAssessments />;
      break;
    case 'progress':
      page = <MyProgress />;
      break;
    case 'history':
      page = <TrainingHistory />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    case 'trainer':
      page = isStaff ? <TrainerDashboard /> : <Dashboard />;
      break;
    case 'materials':
      page = isStaff ? <TrainingMaterials /> : <Dashboard />;
      break;
    case 'users':
      page = isStaff ? <UserManagement /> : <Dashboard />;
      break;
    default:
      page = mode === 'trainer' ? <TrainerDashboard /> : <Dashboard />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">{page}</div>
    </div>
  );
}

function AuthGate() {
  const { session, profile, loading, signOut } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-lava-400 animate-spin" /></div>;
  }
  if (!session) return <Login />;
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-6 max-w-md text-center space-y-3">
          <p className="text-sm text-white font-medium">Your account profile could not be loaded.</p>
          <p className="text-xs text-muted-400">
            The database migrations may not have been applied yet (they create the <code className="font-mono">profiles</code> table and its sign-up trigger).
          </p>
          <button onClick={signOut} className="btn-secondary text-xs mx-auto">Sign out</button>
        </div>
      </div>
    );
  }
  return (
    <AppProvider key={profile.id}>
      <AppContent />
    </AppProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
