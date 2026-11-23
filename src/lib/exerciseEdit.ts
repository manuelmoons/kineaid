import { supabase } from './supabase';
import type { BodyPart } from './bodyParts';
import { SOURCE_LABELS, type Exercise, type ExerciseKind, type Lang } from './exercises';

const BUCKET = 'exercise-images';
export const LANGS: Lang[] = ['nl', 'en'];

export interface TranslationDraft {
  name: string;
  description: string;
  /** One step / point per line. */
  instructions: string;
  attention_points: string;
}

export interface ImageDraft {
  /** Stable key for React lists. */
  key: string;
  url: string;
  storage_path: string | null;
  license: string | null;
  author: string | null;
  /** New photo chosen on this device, not uploaded yet. */
  file?: File;
}

export interface ExerciseDraft {
  kind: ExerciseKind;
  per_side: boolean;
  body_parts: BodyPart[];
  equipment: string;
  level: '' | 'beginner' | 'intermediate' | 'expert';
  default_sets: number;
  default_reps: number | null;
  default_hold_sec: number | null;
  default_rest_sec: number;
  video_url: string;
  source_url: string | null;
  license: string | null;
  author: string | null;
  translations: Record<Lang, TranslationDraft>;
  images: ImageDraft[];
}

const emptyTranslation = (): TranslationDraft => ({ name: '', description: '', instructions: '', attention_points: '' });

export function emptyDraft(): ExerciseDraft {
  return {
    kind: 'reps',
    per_side: false,
    body_parts: [],
    equipment: '',
    level: '',
    default_sets: 3,
    default_reps: 10,
    default_hold_sec: 30,
    default_rest_sec: 30,
    video_url: '',
    source_url: null,
    license: null,
    author: null,
    translations: { nl: emptyTranslation(), en: emptyTranslation() },
    images: [],
  };
}

let keyCounter = 0;
export const newKey = () => `k${++keyCounter}`;

/**
 * Draft from an existing exercise. With `copy`, the result is a new exercise of the kine
 * that keeps a reference to where it came from (needed for the license of imported exercises).
 */
export function draftFrom(ex: Exercise, copy: boolean): ExerciseDraft {
  const d = emptyDraft();
  for (const tr of ex.exercise_translations ?? []) {
    d.translations[tr.locale] = {
      name: tr.name,
      description: tr.description ?? '',
      instructions: (tr.instructions ?? []).join('\n'),
      attention_points: (tr.attention_points ?? []).join('\n'),
    };
  }
  const source = SOURCE_LABELS[ex.source];
  return {
    ...d,
    kind: ex.kind,
    per_side: ex.per_side,
    body_parts: ex.body_parts,
    equipment: ex.equipment ?? '',
    level: (ex.level as ExerciseDraft['level']) ?? '',
    default_sets: ex.default_sets,
    default_reps: ex.default_reps,
    default_hold_sec: ex.default_hold_sec,
    default_rest_sec: ex.default_rest_sec,
    video_url: ex.video_url ?? '',
    source_url: copy && !ex.owner_id ? ex.source_url || source?.url || null : ex.source_url,
    license: ex.license,
    author: copy && !ex.owner_id ? ex.author || source?.name || ex.source : ex.author,
    images: [...(ex.exercise_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((img) => ({
        key: newKey(),
        url: img.url,
        // A copy must not own (and later delete) the original's stored file.
        storage_path: copy ? null : (img.storage_path ?? null),
        license: img.license,
        author: img.author,
      })),
  };
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Shrink big photos before upload (max 1600 px, JPEG). Falls back to the original file. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function uploadPhoto(ownerId: string, exerciseId: string, file: File) {
  const blob = await shrink(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${ownerId}/${exerciseId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || file.type });
  if (error) throw error;
  return { path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

/** Create (no id) or update an exercise of the logged-in kine. Returns its id. */
export async function saveExercise(ownerId: string, draft: ExerciseDraft, id?: string, previousImages: ImageDraft[] = []): Promise<string> {
  const row = {
    kind: draft.kind,
    per_side: draft.per_side,
    body_parts: draft.body_parts,
    equipment: draft.equipment.trim() || null,
    level: draft.level || null,
    default_sets: draft.default_sets,
    default_reps: draft.default_reps,
    default_hold_sec: draft.kind === 'time' ? draft.default_hold_sec : null,
    default_rest_sec: draft.default_rest_sec,
    video_url: draft.video_url.trim() || null,
    source_url: draft.source_url,
    license: draft.license,
    author: draft.author,
    updated_at: new Date().toISOString(),
  };

  let exerciseId = id;
  if (exerciseId) {
    const { error } = await supabase.from('exercises').update(row).eq('id', exerciseId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('exercises')
      .insert({ ...row, owner_id: ownerId, source: 'custom' })
      .select('id')
      .single();
    if (error) throw error;
    exerciseId = data.id as string;
  }

  // Translations: keep the languages that have a name.
  const filled = LANGS.filter((l) => draft.translations[l].name.trim());
  if (filled.length) {
    const { error } = await supabase.from('exercise_translations').upsert(
      filled.map((locale) => {
        const tr = draft.translations[locale];
        return {
          exercise_id: exerciseId,
          locale,
          name: tr.name.trim(),
          description: tr.description.trim() || null,
          instructions: lines(tr.instructions),
          attention_points: lines(tr.attention_points),
        };
      }),
    );
    if (error) throw error;
  }
  const empty = LANGS.filter((l) => !filled.includes(l));
  if (empty.length) {
    const { error } = await supabase.from('exercise_translations').delete().eq('exercise_id', exerciseId).in('locale', empty);
    if (error) throw error;
  }

  // Photos: upload new files, then replace the image rows in the new order.
  const finalImages = [];
  for (const img of draft.images) {
    if (img.file) {
      const up = await uploadPhoto(ownerId, exerciseId, img.file);
      finalImages.push({ url: up.url, storage_path: up.path, license: null, author: null });
    } else {
      finalImages.push({ url: img.url, storage_path: img.storage_path, license: img.license, author: img.author });
    }
  }
  const { error: delErr } = await supabase.from('exercise_images').delete().eq('exercise_id', exerciseId);
  if (delErr) throw delErr;
  if (finalImages.length) {
    const { error } = await supabase
      .from('exercise_images')
      .insert(finalImages.map((img, position) => ({ ...img, exercise_id: exerciseId, position })));
    if (error) throw error;
  }
  const kept = new Set(finalImages.map((i) => i.storage_path).filter(Boolean));
  const removed = previousImages.map((i) => i.storage_path).filter((p): p is string => !!p && !kept.has(p));
  if (removed.length) await supabase.storage.from(BUCKET).remove(removed); // best effort

  return exerciseId;
}

export class ExerciseInUseError extends Error {
  constructor(public programCount: number) {
    super('exercise in use');
  }
}

/** Delete an own exercise and its stored photos. Fails with ExerciseInUseError when a program still uses it. */
export async function deleteExercise(ex: Exercise) {
  const { count, error: cErr } = await supabase
    .from('program_items')
    .select('program_id', { count: 'exact', head: true })
    .eq('exercise_id', ex.id);
  if (cErr) throw cErr;
  if (count) throw new ExerciseInUseError(count);

  const paths = (ex.exercise_images ?? []).map((i) => i.storage_path).filter((p): p is string => !!p);
  const { error } = await supabase.from('exercises').delete().eq('id', ex.id);
  if (error) {
    // 23503 = still referenced (e.g. by a patient's program the kine cannot see)
    if (error.code === '23503') throw new ExerciseInUseError(1);
    throw error;
  }
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
