import { supabase } from './supabase';
import { EXERCISE_DETAIL_SELECT, type Exercise } from './exercises';

export interface ProgramItem {
  id: string;
  program_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps: number | null;
  hold_sec: number | null;
  rest_sec: number;
  times_per_day: number;
  days_per_week: number;
  note: string | null;
  exercises: Exercise;
}

export interface Program {
  id: string;
  patient_id: string;
  kine_id: string | null;
  name: string;
  active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface ProgramWithItems extends Program {
  program_items: ProgramItem[];
}

export async function listPrograms(patientId: string): Promise<(Program & { item_count: number })[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*, program_items(count)')
    .eq('patient_id', patientId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ ...p, item_count: p.program_items?.[0]?.count ?? 0 }));
}

export async function getProgram(id: string): Promise<ProgramWithItems> {
  const { data, error } = await supabase
    .from('programs')
    .select(`*, program_items(*, exercises(${EXERCISE_DETAIL_SELECT}))`)
    .eq('id', id)
    .order('position', { referencedTable: 'program_items' })
    .single();
  if (error) throw error;
  return data as unknown as ProgramWithItems;
}

export async function createProgram(input: { patient_id: string; kine_id: string | null; name: string }): Promise<Program> {
  const { data, error } = await supabase.from('programs').insert(input).select().single();
  if (error) throw error;
  return data as Program;
}

export async function updateProgram(id: string, patch: Partial<Pick<Program, 'name' | 'active' | 'end_date'>>) {
  const { error } = await supabase.from('programs').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProgram(id: string) {
  const { error } = await supabase.from('programs').delete().eq('id', id);
  if (error) throw error;
}

export async function addProgramItem(programId: string, exercise: Exercise, position: number) {
  const { error } = await supabase.from('program_items').insert({
    program_id: programId,
    exercise_id: exercise.id,
    position,
    sets: exercise.default_sets,
    reps: exercise.default_reps,
    hold_sec: exercise.kind === 'time' ? exercise.default_hold_sec ?? 30 : null,
    rest_sec: exercise.default_rest_sec,
  });
  if (error) throw error;
}

export type ItemPatch = Partial<Pick<ProgramItem, 'sets' | 'reps' | 'hold_sec' | 'rest_sec' | 'times_per_day' | 'days_per_week' | 'note' | 'position'>>;

export async function updateProgramItem(id: string, patch: ItemPatch) {
  const { error } = await supabase.from('program_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProgramItem(id: string) {
  const { error } = await supabase.from('program_items').delete().eq('id', id);
  if (error) throw error;
}

// ─── Workout logging ──────────────────────────────────────────

export async function startSession(programId: string, patientId: string): Promise<string> {
  const { data, error } = await supabase
    .from('session_logs')
    .insert({ program_id: programId, patient_id: patientId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function logExercise(sessionId: string, programItemId: string, setsDone: number, completed: boolean) {
  const { error } = await supabase
    .from('exercise_logs')
    .insert({ session_id: sessionId, program_item_id: programItemId, sets_done: setsDone, completed });
  if (error) throw error;
}

export async function completeSession(sessionId: string) {
  const { error } = await supabase.from('session_logs').update({ completed_at: new Date().toISOString() }).eq('id', sessionId);
  if (error) throw error;
}

export interface SessionStats {
  todayCount: number;
  streakDays: number;
  last: { started_at: string; completed_at: string | null; program_id: string }[];
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export async function getSessionStats(patientId: string): Promise<SessionStats> {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data, error } = await supabase
    .from('session_logs')
    .select('started_at, completed_at, program_id')
    .eq('patient_id', patientId)
    .not('completed_at', 'is', null)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const days = new Set(rows.map((r) => dayKey(new Date(r.started_at))));
  const today = new Date();
  const todayCount = rows.filter((r) => dayKey(new Date(r.started_at)) === dayKey(today)).length;

  // Streak: consecutive days with at least one completed session, ending today (or yesterday)
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { todayCount, streakDays: streak, last: rows.slice(0, 10) };
}
