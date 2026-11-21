export const BODY_PARTS = [
  'neck',
  'shoulder',
  'arm',
  'wrist_hand',
  'chest',
  'upper_back',
  'lower_back',
  'core',
  'hip',
  'knee',
  'ankle_foot',
  'full_body',
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

/**
 * Maps muscle / category names (from free-exercise-db and wger, English or Latin)
 * to the body parts a physiotherapist filters on.
 */
const RULES: Array<[RegExp, BodyPart[]]> = [
  [/neck|sternocleido|splenius/, ['neck']],
  [/trap/, ['neck', 'upper_back']],
  [/shoulder|deltoid|rotator|supraspin|infraspin|teres|serratus/, ['shoulder']],
  [/bicep(?!s femoris)|tricep|brachi|arm/, ['arm']],
  [/forearm|wrist|hand|finger|grip/, ['wrist_hand']],
  [/chest|pector/, ['chest']],
  [/lat(s|issimus)?\b|middle back|rhomboid|upper back/, ['upper_back']],
  [/lower back|erector|lumbar/, ['lower_back']],
  [/^back$/, ['upper_back', 'lower_back']], // wger category "Back"
  [/abs\b|abdominal|oblique|rectus abdominis|core|transvers/, ['core']],
  [/glute|abductor|adductor|hip|piriform|iliopsoas/, ['hip']],
  [/quad|femoris|vastus|hamstring|biceps femoris/, ['knee']],
  [/hamstring|biceps femoris/, ['hip']],
  [/calf|calves|gastrocnem|soleus|tibialis|ankle|foot/, ['ankle_foot']],
  [/\blegs?\b/, ['hip', 'knee']],
  [/cardio|full body/, ['full_body']],
];

export function mapToBodyParts(names: string[]): BodyPart[] {
  const result = new Set<BodyPart>();
  for (const raw of names) {
    const name = raw.toLowerCase();
    for (const [re, parts] of RULES) {
      if (re.test(name)) parts.forEach((p) => result.add(p));
    }
  }
  return BODY_PARTS.filter((p) => result.has(p));
}
