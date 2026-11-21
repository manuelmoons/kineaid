import { useTranslation } from 'react-i18next';
import ExerciseBrowser from '../components/ExerciseBrowser';

export default function Library() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('library.title')}</h1>
      <ExerciseBrowser />
    </div>
  );
}
