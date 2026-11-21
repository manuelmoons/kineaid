import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Program } from '../lib/programs';

/** List of programs with Start / Edit buttons. */
export default function ProgramList({
  programs,
  canEdit,
  canStart,
}: {
  programs: (Program & { item_count: number })[];
  canEdit: (p: Program) => boolean;
  canStart: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-3">
      {programs.map((p) => (
        <li key={p.id} className={`card flex flex-wrap items-center gap-3 ${p.active ? '' : 'opacity-60'}`}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.name}</p>
            <p className="text-sm text-slate-500">
              {t('program.exerciseCount', { count: p.item_count })}
              {!p.active && ` · ${t('program.inactive')}`}
              {p.kine_id ? '' : ` · ${t('program.ownProgram')}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/programs/${p.id}`} className="btn-secondary px-3 py-2 text-sm">
              {canEdit(p) ? t('program.edit') : t('program.view')}
            </Link>
            {canStart && p.active && p.item_count > 0 && (
              <Link to={`/workout/${p.id}`} className="btn-primary px-4 py-2 text-sm">
                ▶ {t('workout.start')}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
