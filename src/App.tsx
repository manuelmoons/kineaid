import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './lib/auth';
import { isSupabaseConfigured } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Onboarding, { hasOnboarded } from './pages/Onboarding';
import Join from './pages/Join';
import PatientHome from './pages/PatientHome';
import KineHome from './pages/KineHome';
import Credits from './pages/Credits';
import Library from './pages/Library';
import ExerciseDetail from './pages/ExerciseDetail';
import ProgramEditor from './pages/ProgramEditor';
import Workout from './pages/Workout';
import KinePatient from './pages/KinePatient';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  if (loading) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  if (!profile) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;
  if (profile.role === 'kine') return <Navigate to="/kine" replace />;
  if (!hasOnboarded()) return <Navigate to="/welcome" replace />;
  return <Navigate to="/patient" replace />;
}

function SetupMissing() {
  const { t } = useTranslation();
  return (
    <div className="card mx-auto mt-10 max-w-md">
      <h1 className="mb-2 text-lg font-bold">{t('setup.title')}</h1>
      <p className="text-slate-600">{t('setup.body')}</p>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      {!isSupabaseConfigured ? (
        <Routes>
          <Route path="/credits" element={<Credits />} />
          <Route path="*" element={<SetupMissing />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/" element={<RequireAuth><HomeRedirect /></RequireAuth>} />
          <Route path="/welcome" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="/patient" element={<RequireAuth><PatientHome /></RequireAuth>} />
          <Route path="/kine" element={<RequireAuth><KineHome /></RequireAuth>} />
          <Route path="/kine/patients/:patientId" element={<RequireAuth><KinePatient /></RequireAuth>} />
          <Route path="/library" element={<RequireAuth><Library /></RequireAuth>} />
          <Route path="/exercise/:id" element={<RequireAuth><ExerciseDetail /></RequireAuth>} />
          <Route path="/programs/:id" element={<RequireAuth><ProgramEditor /></RequireAuth>} />
          <Route path="/workout/:id" element={<RequireAuth><Workout /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Layout>
  );
}
