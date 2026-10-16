import { Component, Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Navigate, Outlet, Route, useLocation, useParams } from 'react-router';
import { SessionProvider, useSession } from './Session';
import { Shell } from './Shell';
import { safeReturn } from './navigation';
import { onboardingComplete, COURSE } from '../contracts/profile';
import { Welcome } from '../features/auth/Welcome';
import { SignIn } from '../features/auth/SignIn';
import { Onboarding } from '../features/onboarding/Onboarding';
import { Home, Subjects, SubjectOverview } from '../features/home/Home';
import { Profile } from '../features/profile/Profile';
import { AssessmentProvider } from '../features/assessment/AssessmentState';
import { MaterialsProvider } from '../features/intake/Materials';
import { ActionLink, Button, StateScreen } from '../ui/kit';
import type { Services } from '../services/types';

const LabHome = lazy(() => import('../features/labs/LabPreparation').then(m => ({ default: m.LabHome })));
const LabTracker = lazy(() => import('../features/labs/LabPreparation').then(m => ({ default: m.LabTracker })));
const ChapterMapScreen = lazy(() => import('../features/learning/ChapterMapScreen').then(m => ({ default: m.ChapterMapScreen })));
const LessonScreen = lazy(() => import('../features/learning/LessonScreen').then(m => ({ default: m.LessonScreen })));
const AddMaterial = lazy(() => import('../features/intake/AddMaterial').then(m => ({ default: m.AddMaterial })));
const MaterialRequest = lazy(() => import('../features/intake/Request').then(m => ({ default: m.MaterialRequest })));
const Library = lazy(() => import('../features/library/Library').then(m => ({ default: m.Library })));
const SourceViewer = lazy(() => import('../features/library/Library').then(m => ({ default: m.SourceViewer })));
const Checks = lazy(() => import('../features/assessment/Checks').then(m => ({ default: m.Checks })));
const StartCheck = lazy(() => import('../features/assessment/StartCheck').then(m => ({ default: m.StartCheck })));
const RunCheck = lazy(() => import('../features/assessment/RunCheck').then(m => ({ default: m.RunCheck })));
const ConnectionCheck = import.meta.env.DEV ? lazy(() => import('../features/auth/ConnectionCheck').then(m => ({ default: m.ConnectionCheck }))) : null;
function Deferred({ children }: { children: ReactNode }) { return <Suspense fallback={<p role="status">Opening your page…</p>}>{children}</Suspense>; }

function Gate({ onboarding = false }: { onboarding?: boolean }) {
  const { status, identity, services, profile, error, retry, logout } = useSession();
  const location = useLocation();
  if (status === 'checking' || status === 'loading') return <StateScreen title={status === 'checking' ? 'Checking your sign-in…' : 'Opening your learning space…'} />;
  if (status === 'error') return <StateScreen title={identity && services.mode === 'connected' ? 'You’re signed in. Your learning profile couldn’t open.' : 'Your learning space couldn’t open.'} action={<div className="form-actions"><Button onClick={retry}>Retry</Button><Button variant="secondary" onClick={() => { logout().catch(() => undefined); }}>Sign out</Button></div>}>{error}</StateScreen>;
  if (!profile) return <Navigate to={`/auth?returnTo=${encodeURIComponent(safeReturn(location.pathname + location.search))}`} replace />;
  if (!onboarding && !onboardingComplete(profile)) return <Navigate to={`/onboarding?returnTo=${encodeURIComponent(safeReturn(location.pathname + location.search))}`} replace />;
  if (onboarding && onboardingComplete(profile)) return <Navigate to="/home" replace />;
  return <Outlet />;
}
function PublicGate() {
  const { status, identity, services, error, retry, logout } = useSession();
  if (status === 'checking' || status === 'loading') return <StateScreen title={status === 'checking' ? 'Checking your sign-in…' : 'Opening your learning space…'} />;
  if (status === 'error') return <StateScreen title={identity && services.mode === 'connected' ? 'You’re signed in. Your learning profile couldn’t open.' : 'We couldn’t finish opening Kiki.'} action={<div className="form-actions"><Button onClick={retry}>Retry</Button><Button variant="secondary" onClick={() => { logout().catch(() => undefined); }}>Sign out</Button></div>}>{error}</StateScreen>;
  return <Outlet />;
}
function SelectedSubject() { const { courseId } = useParams(); return courseId === COURSE.id ? <SubjectOverview /> : <StateScreen title="This subject wasn’t found." action={<ActionLink to="/subjects">My subjects</ActionLink>} />; }
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <StateScreen title="Something interrupted Kiki." action={<Button onClick={() => window.location.reload()}>Reload Kiki</Button>}>Your saved preferences will be loaded again.</StateScreen> : this.props.children; }
}
function Providers({ services }: { services: Services }) { return <SessionProvider services={services}><MaterialsProvider><AssessmentProvider><Outlet /></AssessmentProvider></MaterialsProvider></SessionProvider>; }
export function createAppRouter(services: Services) {
  return createBrowserRouter(createRoutesFromElements(<Route element={<Providers services={services} />} errorElement={<StateScreen title="Something interrupted Kiki." action={<Button onClick={() => window.location.reload()}>Reload Kiki</Button>} />} >
    {ConnectionCheck && <Route path="/connection" element={<Deferred><ConnectionCheck /></Deferred>} />}
    <Route element={<PublicGate />}><Route path="/" element={<Welcome />} /><Route path="/auth" element={<SignIn />} /></Route>
    <Route element={<Gate onboarding />}><Route path="/onboarding" element={<Onboarding />} /></Route>
    <Route element={<Gate />}><Route element={<Shell />}>
      <Route path="/home" element={<Home />} /><Route path="/subjects" element={<Subjects />} /><Route path="/subjects/:courseId" element={<SelectedSubject />} /><Route path="/profile" element={<Profile />} />
      <Route path="/subjects/:courseId/material" element={<Deferred><AddMaterial /></Deferred>} />
      <Route path="/intake/:requestId" element={<Deferred><MaterialRequest /></Deferred>} />
      <Route path="/learn" element={<Navigate to={`/chapters/${COURSE.chapterId}`} replace />} />
      <Route path="/chapters/:planId" element={<Deferred><ChapterMapScreen /></Deferred>} />
      <Route path="/concepts/:conceptId" element={<Deferred><LessonScreen /></Deferred>} />
      <Route path="/labs" element={<Deferred><LabHome /></Deferred>} />
      <Route path="/labs/:sessionId" element={<Deferred><LabTracker /></Deferred>} />
      <Route path="/library" element={<Deferred><Library /></Deferred>} />
      <Route path="/library/:sourceId" element={<Deferred><SourceViewer /></Deferred>} />
      <Route path="/practice" element={<Deferred><Checks /></Deferred>} />
      <Route path="/assessments/:assessmentId/new" element={<Deferred><StartCheck /></Deferred>} />
      <Route path="/assessments/:assessmentId/:runId" element={<Deferred><RunCheck /></Deferred>} />
    </Route></Route>
    <Route path="*" element={<StateScreen title="We couldn’t find that page." action={<ActionLink to="/home">Go to home</ActionLink>} />} />
  </Route>));
}
export function App({ router }: { router: ReturnType<typeof createAppRouter> }) { return <ErrorBoundary><RouterProvider router={router} /></ErrorBoundary>; }
