import { supabase } from './supabase';
import type { BodyPart } from './bodyParts';

export type Lang = 'nl' | 'en';
export type ExerciseKind = 'reps' | 'time';

export interface ExerciseSummary {
  id: string;
  kind: ExerciseKind;
  body_parts: BodyPart[];
  equipment: string | null;
  level: string | null;
  source: string;
  owner_id: string | null;
  name: string;
  image_url: string | null;
}

export interface ExerciseTranslation {
  locale: Lang;
  name: string;
  description: string | null;
  instructions: string[];
  attention_points: string[];
}

export interface ExerciseImage {
  id: string;
  url: string;
  storage_path?: string | null;
  position: number;
  license: string | null;
  author: string | null;
}

export interface Exercise {
  id: string;
  kind: ExerciseKind;
  per_side: boolean;
  body_parts: BodyPart[];
  muscles: string[];
  equipment: string | null;
  level: string | null;
  default_sets: number;
  default_reps: number | null;
  default_hold_sec: number | null;
  default_rest_sec: number;
  video_url: string | null;
  source: string;
  source_id: string | null;
  source_url: string | null;
  license: string | null;
  author: string | null;
  owner_id: string | null;
  exercise_translations: ExerciseTranslation[];
  exercise_images: ExerciseImage[];
}

/** Text for the current language, falling back to the other one. */
export function pickTranslation(translations: ExerciseTranslation[] | undefined, lang: Lang): ExerciseTranslation | undefined {
  if (!translations?.length) return undefined;
  return translations.find((t) => t.locale === lang) ?? translations.find((t) => t.locale === 'en') ?? translations[0];
}

export function normalizeLang(lng: string | undefined): Lang {
  return lng?.startsWith('en') ? 'en' : 'nl';
}

/** Only keep characters that are safe inside a PostgREST or() filter. */
const sanitize = (q: string) => q.replace(/[^\p{L}\p{N} '\-]/gu, ' ').trim();

export async function searchExercises(opts: {
  q?: string;
  bodyPart?: BodyPart | null;
  lang: Lang;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ExerciseSummary[]; total: number }> {
  const pageSize = opts.pageSize ?? 24;
  const page = opts.page ?? 0;
  const display = opts.lang === 'en' ? 'display_en' : 'display_nl';

  let query = supabase
    .from('exercise_list')
    .select(`id, kind, body_parts, equipment, level, source, owner_id, image_url, name:${display}`, { count: 'exact' });

  const q = sanitize(opts.q ?? '');
  if (q) {
    const pattern = `*${q.replace(/\s+/g, '*')}*`;
    query = query.or(`name_en.ilike.${pattern},name_nl.ilike.${pattern}`);
  }
  if (opts.bodyPart) query = query.contains('body_parts', [opts.bodyPart]);

  const { data, count, error } = await query
    .order('priority')
    .order(display)
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return { items: (data ?? []) as unknown as ExerciseSummary[], total: count ?? 0 };
}

export const EXERCISE_DETAIL_SELECT =
  'id, kind, per_side, body_parts, muscles, equipment, level, default_sets, default_reps, default_hold_sec, default_rest_sec, video_url, source, source_id, source_url, license, author, owner_id, exercise_translations(locale, name, description, instructions, attention_points), exercise_images(id, url, storage_path, position, license, author)';

export async function getExercise(id: string): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_DETAIL_SELECT)
    .eq('id', id)
    .order('position', { referencedTable: 'exercise_images' })
    .single();
  if (error) throw error;
  return data as unknown as Exercise;
}

export const SOURCE_LABELS: Record<string, { name: string; url?: string }> = {
  kineaid: { name: 'KineAid' },
  'free-exercise-db': { name: 'free-exercise-db', url: 'https://github.com/yuhonas/free-exercise-db' },
  wger: { name: 'wger', url: 'https://wger.de' },
  custom: { name: '' },
};
