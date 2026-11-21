/**
 * Imports the exercise library into Supabase from:
 *   - KineAid's own rehab set       (scripts/data/kineaid-exercises.json, NL + EN)
 *   - free-exercise-db (Unlicense)  https://github.com/yuhonas/free-exercise-db
 *   - wger (CC-BY-SA)               https://wger.de
 *
 * Every exercise keeps its source, source URL, license and author so the app can credit it.
 *
 * Usage:
 *   npm run import:exercises                         # all sources
 *   npm run import:exercises -- --sources=kineaid,free-exercise-db
 *   npm run import:exercises -- --dry-run            # writes scripts/.cache/preview.json, no DB writes
 *
 * Needs VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env (not needed for --dry-run).
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { mapToBodyParts, type BodyPart } from '../src/lib/bodyParts.ts';

type Locale = 'nl' | 'en';

interface Translation {
  name: string;
  description?: string;
  instructions: string[];
  attention_points: string[];
}

interface ImportExercise {
  source: 'kineaid' | 'free-exercise-db' | 'wger';
  source_id: string;
  source_url: string;
  license: string;
  author: string;
  kind: 'reps' | 'time';
  per_side: boolean;
  body_parts: BodyPart[];
  muscles: string[];
  equipment: string | null;
  level: 'beginner' | 'intermediate' | 'expert' | null;
  default_sets: number;
  default_reps: number | null;
  default_hold_sec: number | null;
  default_rest_sec: number;
  translations: Partial<Record<Locale, Translation>>;
  images: { url: string; license: string; author: string }[];
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sourcesArg = args.find((a) => a.startsWith('--sources='))?.split('=')[1];
const sources = new Set(sourcesArg ? sourcesArg.split(',') : ['kineaid', 'free-exercise-db', 'wger']);

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// ─── KineAid own set ──────────────────────────────────────────
async function loadKineAid(): Promise<ImportExercise[]> {
  const raw = JSON.parse(await readFile(new URL('./data/kineaid-exercises.json', import.meta.url), 'utf8'));
  return raw.map((e: any): ImportExercise => ({
    source: 'kineaid',
    source_id: e.id,
    source_url: '',
    license: 'KineAid',
    author: 'KineAid',
    kind: e.kind,
    per_side: !!e.per_side,
    body_parts: e.body_parts,
    muscles: e.muscles ?? [],
    equipment: e.equipment ?? null,
    level: e.level ?? null,
    default_sets: e.default_sets ?? 3,
    default_reps: e.default_reps ?? null,
    default_hold_sec: e.default_hold_sec ?? null,
    default_rest_sec: e.default_rest_sec ?? 30,
    translations: { nl: e.nl, en: e.en },
    images: [],
  }));
}

// ─── free-exercise-db ─────────────────────────────────────────
const FEDB_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';
// Categories that make no sense for home rehab
const FEDB_SKIP_CATEGORIES = new Set(['strongman', 'olympic weightlifting', 'powerlifting']);

async function loadFreeExerciseDb(): Promise<ImportExercise[]> {
  const res = await fetch(`${FEDB_BASE}/dist/exercises.json`);
  if (!res.ok) throw new Error(`free-exercise-db: HTTP ${res.status}`);
  const data = (await res.json()) as any[];
  return data
    .filter((e) => !FEDB_SKIP_CATEGORIES.has(e.category))
    .map((e): ImportExercise => {
      const isStretch = e.category === 'stretching';
      const muscles: string[] = [...(e.primaryMuscles ?? []), ...(e.secondaryMuscles ?? [])];
      const bodyParts = mapToBodyParts(e.primaryMuscles?.length ? e.primaryMuscles : muscles);
      return {
        source: 'free-exercise-db',
        source_id: e.id,
        source_url: 'https://github.com/yuhonas/free-exercise-db',
        license: 'Unlicense (public domain)',
        author: 'free-exercise-db contributors',
        kind: isStretch ? 'time' : 'reps',
        per_side: false,
        body_parts: bodyParts.length ? bodyParts : e.category === 'cardio' ? ['full_body'] : [],
        muscles,
        equipment: e.equipment ?? null,
        level: ['beginner', 'intermediate', 'expert'].includes(e.level) ? e.level : null,
        default_sets: isStretch ? 2 : 3,
        default_reps: isStretch ? null : 10,
        default_hold_sec: isStretch ? 30 : null,
        default_rest_sec: 30,
        translations: {
          en: { name: e.name, instructions: e.instructions ?? [], attention_points: [] },
        },
        images: (e.images ?? []).map((p: string) => ({
          url: `${FEDB_BASE}/exercises/${p}`,
          license: 'Unlicense (public domain)',
          author: 'free-exercise-db contributors',
        })),
      };
    });
}

// ─── wger ─────────────────────────────────────────────────────
const WGER = 'https://wger.de/api/v2';
const FREE_IMAGE_LICENSE = /cc[- ]?by|cc0|public domain/i;

async function wgerAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `${WGER}${path}${path.includes('?') ? '&' : '?'}limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`wger ${url}: HTTP ${res.status}`);
    const page = (await res.json()) as { next: string | null; results: T[] };
    out.push(...page.results);
    url = page.next;
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|li|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, '\n')
    .trim();
}

async function loadWger(skipNames: Set<string>): Promise<ImportExercise[]> {
  const [languages, licenses, infos] = await Promise.all([
    wgerAll<{ id: number; short_name: string }>('/language/'),
    wgerAll<{ id: number; short_name: string; full_name: string; url: string }>('/license/'),
    wgerAll<any>('/exerciseinfo/'),
  ]);
  const langId = (code: string) => languages.find((l) => l.short_name === code)?.id;
  const licenseName = (l: any): string => {
    if (l && typeof l === 'object') return l.short_name ?? l.full_name ?? '';
    return licenses.find((x) => x.id === l)?.short_name ?? '';
  };
  const EN = langId('en');
  const NL = langId('nl');

  const result: ImportExercise[] = [];
  for (const info of infos) {
    const translations: any[] = info.translations ?? info.exercises ?? [];
    const en = translations.find((t) => t.language === EN);
    if (!en?.name) continue;
    if (skipNames.has(normalize(en.name))) continue; // already in free-exercise-db
    const nl = translations.find((t) => t.language === NL);

    const muscles: string[] = [...(info.muscles ?? []), ...(info.muscles_secondary ?? [])].map(
      (m: any) => m.name_en || m.name,
    );
    const primary: string[] = (info.muscles ?? []).map((m: any) => `${m.name_en ?? ''} ${m.name ?? ''}`);
    let bodyParts = mapToBodyParts(primary);
    if (!bodyParts.length && info.category?.name) bodyParts = mapToBodyParts([info.category.name]);

    const toTranslation = (t: any): Translation => ({
      name: t.name,
      description: t.description ? stripHtml(t.description) : undefined,
      instructions: [],
      attention_points: [],
    });

    const isCardio = /cardio/i.test(info.category?.name ?? '');
    result.push({
      source: 'wger',
      source_id: String(info.id),
      source_url: `https://wger.de/en/exercise/${info.id}/view-base`,
      license: licenseName(en.license ?? info.license) || 'CC-BY-SA 4.0',
      author: en.license_author || info.license_author || 'wger.de contributors',
      kind: 'reps',
      per_side: false,
      body_parts: bodyParts.length ? bodyParts : isCardio ? ['full_body'] : [],
      muscles,
      equipment: (info.equipment ?? []).map((e: any) => e.name).join(', ') || null,
      level: null,
      default_sets: 3,
      default_reps: 10,
      default_hold_sec: null,
      default_rest_sec: 30,
      translations: { en: toTranslation(en), ...(nl?.name ? { nl: toTranslation(nl) } : {}) },
      images: (info.images ?? [])
        .map((img: any) => ({
          url: img.image as string,
          license: licenseName(img.license),
          author: (img.license_author as string) || 'wger.de contributors',
          is_main: !!img.is_main,
        }))
        .filter((img: any) => img.url && FREE_IMAGE_LICENSE.test(img.license))
        .sort((a: any, b: any) => Number(b.is_main) - Number(a.is_main))
        .map(({ url, license, author }: any) => ({ url, license, author })),
    });
  }
  return result;
}

// ─── Supabase upsert ──────────────────────────────────────────
async function upsertAll(exercises: ImportExercise[]) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const CHUNK = 100;
  for (let i = 0; i < exercises.length; i += CHUNK) {
    const chunk = exercises.slice(i, i + CHUNK);
    const { data: rows, error } = await db
      .from('exercises')
      .upsert(
        chunk.map(({ translations: _t, images: _i, ...rest }) => ({ ...rest, owner_id: null, updated_at: new Date().toISOString() })),
        { onConflict: 'source,source_id' },
      )
      .select('id, source, source_id');
    if (error) throw error;

    const idOf = new Map(rows!.map((r) => [`${r.source}:${r.source_id}`, r.id as string]));
    const translations = chunk.flatMap((e) =>
      (Object.entries(e.translations) as [Locale, Translation][]).map(([locale, t]) => ({
        exercise_id: idOf.get(`${e.source}:${e.source_id}`),
        locale,
        name: t.name,
        description: t.description ?? null,
        instructions: t.instructions,
        attention_points: t.attention_points,
      })),
    );
    const { error: tErr } = await db.from('exercise_translations').upsert(translations, { onConflict: 'exercise_id,locale' });
    if (tErr) throw tErr;

    const ids = [...idOf.values()];
    const { error: dErr } = await db.from('exercise_images').delete().in('exercise_id', ids);
    if (dErr) throw dErr;
    const images = chunk.flatMap((e) =>
      e.images.map((img, position) => ({ exercise_id: idOf.get(`${e.source}:${e.source_id}`), position, ...img })),
    );
    if (images.length) {
      const { error: iErr } = await db.from('exercise_images').insert(images);
      if (iErr) throw iErr;
    }
    console.log(`  ${Math.min(i + CHUNK, exercises.length)}/${exercises.length}`);
  }
}

// ─── main ─────────────────────────────────────────────────────
async function main() {
  const all: ImportExercise[] = [];
  if (sources.has('kineaid')) {
    const k = await loadKineAid();
    console.log(`KineAid: ${k.length} exercises`);
    all.push(...k);
  }
  let fedbNames = new Set<string>();
  if (sources.has('free-exercise-db')) {
    const f = await loadFreeExerciseDb();
    fedbNames = new Set(f.map((e) => normalize(e.translations.en!.name)));
    console.log(`free-exercise-db: ${f.length} exercises`);
    all.push(...f);
  }
  if (sources.has('wger')) {
    try {
      const w = await loadWger(fedbNames);
      console.log(`wger: ${w.length} exercises (after removing duplicates)`);
      all.push(...w);
    } catch (err) {
      console.warn(`wger skipped: ${(err as Error).message}`);
    }
  }

  const noBodyPart = all.filter((e) => !e.body_parts.length).length;
  if (noBodyPart) console.log(`Note: ${noBodyPart} exercises have no body part mapped (still searchable by name).`);

  if (dryRun) {
    await mkdir(new URL('./.cache/', import.meta.url), { recursive: true });
    const out = new URL('./.cache/preview.json', import.meta.url);
    await writeFile(out, JSON.stringify(all, null, 2));
    console.log(`Dry run: wrote ${all.length} exercises to ${out.pathname}`);
    return;
  }
  console.log(`Upserting ${all.length} exercises…`);
  await upsertAll(all);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
