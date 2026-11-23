import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import ExerciseBrowser from '../components/ExerciseBrowser';

export default function Library() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('library.title')}</h1>
        {profile?.role === 'kine' && (
          <Link to="/exercise/new" className="btn-primary py-2">
            + {t('library.newExercise')}
          </Link>
        )}
      </div>
      <ExerciseBrowser />
    </div>
  );
}
