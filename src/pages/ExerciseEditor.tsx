import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { BODY_PARTS } from '../lib/bodyParts';
import { getExercise, normalizeLang, type Exercise, type Lang } from '../lib/exercises';
import {
  deleteExercise,
  draftFrom,
  emptyDraft,
  ExerciseInUseError,
  LANGS,
  newKey,
  saveExercise,
  type ExerciseDraft,
  type ImageDraft,
  type TranslationDraft,
} from '../lib/exerciseEdit';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { PUPPET_EXERCISES } from '../puppet/exercises';
import kineaidExercises from '../../scripts/data/kineaid-exercises.json';

const PuppetViewer = lazy(() => import('../puppet/PuppetViewer'));
const PuppetEditor = lazy(() => import('../puppet/PuppetEditor'));
/** KineAid exercises with an animation, as starting points for a new puppet. */
const PUPPET_CHOICES = (kineaidExercises as { id: string; nl: { name: string }; en: { name: string } }[]).filter((e) => PUPPET_EXERCISES[e.id]);

/**
 * Create, edit or copy an exercise of the logged-in kine.
 *   /exercise/new             → new, empty exercise
 *   /exercise/new?copy=<id>   → new exercise based on an existing one
 *   /exercise/<id>/edit       → edit an own exercise
 */
export default function ExerciseEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const copyId = params.get('copy');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const [draft, setDraft] = useState<ExerciseDraft | null>(id || copyId ? null : emptyDraft());
  const [original, setOriginal] = useState<Exercise | null>(null);
  const [lang, setLang] = useState<Lang>(normalizeLang(i18n.resolvedLanguage));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingPuppet, setEditingPuppet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previews = useRef(new Map<string, string>());

  useEffect(() => {
    const sourceId = id ?? copyId;
    if (!sourceId) return;
    getExercise(sourceId)
      .then(async (ex) => {
        if (id) {
          setOriginal(ex);
          setDraft(draftFrom(ex, false));
          return;
        }
        const d = draftFrom(ex, true);
        // Photos stored by a kine are copied as files, so the copy keeps them if the original is deleted.
        d.images = await Promise.all(
          d.images.map(async (img, i) => {
            const stored = ex.exercise_images.find((x) => x.url === img.url)?.storage_path;
            if (!stored) return img;
            try {
              const blob = await (await fetch(img.url)).blob();
              return { ...img, file: new File([blob], `photo-${i}.jpg`, { type: blob.type }) };
            } catch {
              return img;
            }
          }),
        );
        const lng = normalizeLang(i18n.resolvedLanguage);
        if (d.translations[lng].name) d.translations[lng].name += ` (${t('editor.copySuffix')})`;
        setDraft(d);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, copyId]);

  // Free object URLs of photo previews.
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (profile && profile.role !== 'kine') return <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{t('editor.onlyKine')}</p>;
  if (id && original && profile && original.owner_id !== profile.id)
    return <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{t('editor.notOwner')}</p>;
  if (error && !draft) return <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>;
  if (!draft || !profile) return <p className="p-8 text-center text-slate-500">{t('app.loading')}</p>;

  const set = (patch: Partial<ExerciseDraft>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };
  const setTr = (patch: Partial<TranslationDraft>) => set({ translations: { ...draft.translations, [lang]: { ...draft.translations[lang], ...patch } } });
  const tr = draft.translations[lang];
  const otherLang = LANGS.find((l) => l !== lang)!;

  const previewUrl = (img: ImageDraft) => {
    if (!img.file) return img.url;
    let u = previews.current.get(img.key);
    if (!u) {
      u = URL.createObjectURL(img.file);
      previews.current.set(img.key, u);
    }
    return u;
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added: ImageDraft[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ key: newKey(), url: '', storage_path: null, license: null, author: null, file }));
    set({ images: [...draft.images, ...added] });
  };
  const moveImage = (i: number, dir: -1 | 1) => {
    const images = [...draft.images];
    [images[i], images[i + dir]] = [images[i + dir], images[i]];
    set({ images });
  };

  const validate = (): string | null => {
    if (!LANGS.some((l) => draft.translations[l].name.trim())) return t('editor.errName');
    if (!draft.body_parts.length) return t('editor.errBodyPart');
    if (draft.default_sets < 1) return t('editor.errDosage');
    if (draft.kind === 'reps' && !(draft.default_reps && draft.default_reps > 0)) return t('editor.errDosage');
    if (draft.kind === 'time' && !(draft.default_hold_sec && draft.default_hold_sec > 0)) return t('editor.errDosage');
    if (draft.video_url.trim() && !/^https?:\/\//i.test(draft.video_url.trim())) return t('editor.errVideo');
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const previous = original ? draftFrom(original, false).images : [];
      const savedId = await saveExercise(profile.id, draft, id, previous);
      navigate(`/exercise/${savedId}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmingDelete(false);
    if (!original) return;
    setBusy(true);
    setError(null);
    try {
      await deleteExercise(original);
      navigate('/library', { replace: true });
    } catch (e) {
      setError(e instanceof ExerciseInUseError ? t('editor.inUse', { count: e.programCount }) : (e as Error).message);
      setBusy(false);
    }
  };

  const num = (v: string) => (v === '' ? null : Math.max(0, Math.round(Number(v))));

  return (
    <div className="space-y-4 pb-24">
      <button onClick={() => navigate(-1)} className="text-sm text-brand-700 hover:underline">
        ← {t('app.back')}
      </button>
      <h1 className="text-2xl font-bold">{id ? t('editor.titleEdit') : copyId ? t('editor.titleCopy') : t('editor.titleNew')}</h1>

      {/* Texts, per language */}
      <section className="card space-y-3">
        <div className="flex gap-2" role="tablist" aria-label={t('app.language')}>
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                lang === l ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300'
              }`}
            >
              {l.toUpperCase()} {draft.translations[l].name.trim() && '✓'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{t('editor.langHint')}</p>
        <Field label={`${t('editor.name')} *`}>
          <input className="input" value={tr.name} onChange={(e) => setTr({ name: e.target.value })} maxLength={120} />
        </Field>
        <Field label={t('editor.description')}>
          <textarea className="input" rows={2} value={tr.description} onChange={(e) => setTr({ description: e.target.value })} />
        </Field>
        <Field label={t('exercise.instructions')} hint={t('editor.onePerLine')}>
          <textarea className="input" rows={5} value={tr.instructions} onChange={(e) => setTr({ instructions: e.target.value })} />
        </Field>
        <Field label={t('exercise.attention')} hint={t('editor.onePerLine')}>
          <textarea className="input" rows={3} value={tr.attention_points} onChange={(e) => setTr({ attention_points: e.target.value })} />
        </Field>
        {!tr.name.trim() && draft.translations[otherLang].name.trim() && (
          <p className="text-xs text-slate-500">{t('editor.fallbackHint', { lang: otherLang.toUpperCase() })}</p>
        )}
      </section>

      {/* Classification & dosage */}
      <section className="card space-y-4">
        <Field group label={`${t('library.bodyPart')} *`}>
          <div className="flex flex-wrap gap-2">
            {BODY_PARTS.map((p) => {
              const on = draft.body_parts.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ body_parts: on ? draft.body_parts.filter((x) => x !== p) : [...draft.body_parts, p] })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
                    on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {t(`bodyParts.${p}`)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field group label={t('editor.kind')}>
          <div className="grid grid-cols-2 gap-2">
            {(['reps', 'time'] as const).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 ring-1 ${
                  draft.kind === k ? 'bg-brand-50 ring-brand-600' : 'ring-slate-300'
                }`}
              >
                <input type="radio" name="kind" checked={draft.kind === k} onChange={() =>
                    k !== draft.kind &&
                    set({
                      kind: k,
                      // Sensible defaults: one hold of 30 s per set, or 10 repetitions.
                      default_hold_sec: k === 'time' ? (draft.default_hold_sec ?? 30) : draft.default_hold_sec,
                      default_reps: k === 'time' ? 1 : 10,
                    })
                  }
                />
                {k === 'time' ? t('exercise.kindTime') : t('exercise.kindReps')}
              </label>
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.per_side} onChange={(e) => set({ per_side: e.target.checked })} />
          {t('editor.perSide')}
        </label>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">{t('editor.defaultDosage')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={t('program.sets')}>
              <input className="input" type="number" min={1} value={draft.default_sets} onChange={(e) => set({ default_sets: num(e.target.value) ?? 0 })} />
            </Field>
            {draft.kind === 'time' && (
              <Field label={`${t('program.hold')} (s)`}>
                <input className="input" type="number" min={1} value={draft.default_hold_sec ?? ''} onChange={(e) => set({ default_hold_sec: num(e.target.value) })} />
              </Field>
            )}
            <Field label={draft.kind === 'time' ? t('program.repsPerSet') : t('program.reps')}>
              <input
                className="input"
                type="number"
                min={1}
                value={draft.default_reps ?? ''}
                onChange={(e) => set({ default_reps: num(e.target.value) })}
              />
            </Field>
            <Field label={`${t('program.rest')} (s)`}>
              <input className="input" type="number" min={0} value={draft.default_rest_sec} onChange={(e) => set({ default_rest_sec: num(e.target.value) ?? 0 })} />
            </Field>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('editor.equipment')}>
            <input className="input" value={draft.equipment} onChange={(e) => set({ equipment: e.target.value })} placeholder={t('editor.equipmentPlaceholder')} />
          </Field>
          <Field label={t('editor.level')}>
            <select className="input" value={draft.level} onChange={(e) => set({ level: e.target.value as ExerciseDraft['level'] })}>
              <option value="">—</option>
              {(['beginner', 'intermediate', 'expert'] as const).map((l) => (
                <option key={l} value={l}>
                  {t(`editor.levels.${l}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* 3D puppet */}
      <section className="card space-y-3">
        <p className="text-sm font-medium text-slate-700">{t('editor.puppet')}</p>
        {draft.puppet ? (
          <div className="aspect-video overflow-hidden rounded-xl bg-slate-100">
            <Suspense fallback={null}>
              <PuppetViewer exercise={draft.puppet} seed={id ?? 'new'} />
            </Suspense>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('editor.puppetNone')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <select
            className="input flex-1"
            value=""
            onChange={(e) => e.target.value && set({ puppet: PUPPET_EXERCISES[e.target.value] })}
            aria-label={t('editor.puppetFrom')}
          >
            <option value="">{t('editor.puppetFrom')}</option>
            {PUPPET_CHOICES.map((c) => (
              <option key={c.id} value={c.id}>
                {c[normalizeLang(i18n.resolvedLanguage)].name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary" onClick={() => setEditingPuppet(true)}>
            ✎ {draft.puppet ? t('editor.puppetEdit') : t('editor.puppetCreate')}
          </button>
          {draft.puppet && (
            <button type="button" className="btn-secondary text-red-600" onClick={() => set({ puppet: null })}>
              {t('editor.puppetRemove')}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">{t('editor.puppetHint')}</p>
      </section>

      {/* Photos & video */}
      <section className="card space-y-3">
        <p className="text-sm font-medium text-slate-700">{t('editor.photos')}</p>
        {draft.images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {draft.images.map((img, i) => (
              <li key={img.key} className="relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                <div className="aspect-square bg-slate-100">
                  <img src={previewUrl(img)} alt={t('exercise.photo', { n: i + 1 })} className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-red-600 shadow ring-1 ring-slate-200 hover:bg-red-50"
                  onClick={() => set({ images: draft.images.filter((x) => x.key !== img.key) })}
                  aria-label={t('editor.removePhoto')}
                  title={t('editor.removePhoto')}
                >
                  ✕
                </button>
                {draft.images.length > 1 && (
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                    {([-1, 1] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-slate-200 disabled:invisible"
                        disabled={dir === -1 ? i === 0 : i === draft.images.length - 1}
                        onClick={() => moveImage(i, dir)}
                        aria-label={dir === -1 ? t('editor.photoEarlier') : t('editor.photoLater')}
                        title={dir === -1 ? t('editor.photoEarlier') : t('editor.photoLater')}
                      >
                        {dir === -1 ? '←' : '→'}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn-secondary w-full" onClick={() => fileInput.current?.click()}>
          📷 {t('editor.addPhotos')}
        </button>
        <Field label={t('editor.video')}>
          <input className="input" type="url" inputMode="url" placeholder="https://…" value={draft.video_url} onChange={(e) => set({ video_url: e.target.value })} />
        </Field>
        {draft.author && (
          <p className="text-xs text-slate-500">
            {t('editor.basedOn')}: {draft.author}
            {draft.license && ` (${draft.license})`}
          </p>
        )}
      </section>

      {id && (
        <button type="button" className="text-sm text-red-600 hover:underline disabled:opacity-50" onClick={() => setConfirmingDelete(true)} disabled={busy}>
          🗑 {t('editor.delete')}
        </button>
      )}

      {editingPuppet && (
        <Modal title={t('puppetEditor.title')} onClose={() => setEditingPuppet(false)} closeOnBackdrop={false}>
          <Suspense fallback={<p className="p-8 text-center text-slate-500">{t('app.loading')}</p>}>
            <PuppetEditor
              value={draft.puppet}
              onCancel={() => setEditingPuppet(false)}
              onDone={(p) => {
                set({ puppet: p });
                setEditingPuppet(false);
              }}
            />
          </Suspense>
        </Modal>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          danger
          message={t('editor.confirmDelete')}
          confirmLabel={t('editor.delete')}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={remove}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {error && <p className="mx-auto mb-2 max-w-3xl rounded-xl bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
        {!error && dirty && <p className="mx-auto mb-2 max-w-3xl text-center text-sm text-amber-700">{t('editor.unsaved')}</p>}
        <div className="mx-auto flex max-w-3xl gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={() => navigate(-1)} disabled={busy}>
            {t('program.cancel')}
          </button>
          <button type="button" className="btn-primary flex-1" onClick={save} disabled={busy}>
            {busy ? t('editor.saving') : t('editor.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </Tag>
  );
}
