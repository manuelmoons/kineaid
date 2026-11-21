import type { BodyPart } from '../lib/bodyParts';

/** Where to highlight each body part on the simple figure (viewBox 0 0 100 140). */
const SPOTS: Record<BodyPart, Array<[number, number, number]>> = {
  neck: [[50, 27, 6]],
  shoulder: [
    [34, 38, 7],
    [66, 38, 7],
  ],
  arm: [
    [27, 56, 7],
    [73, 56, 7],
  ],
  wrist_hand: [
    [23, 80, 6],
    [77, 80, 6],
  ],
  chest: [[50, 44, 9]],
  upper_back: [[50, 46, 10]],
  lower_back: [[50, 66, 9]],
  core: [[50, 60, 9]],
  hip: [[50, 78, 10]],
  knee: [
    [42, 104, 6],
    [58, 104, 6],
  ],
  ankle_foot: [
    [41, 130, 6],
    [59, 130, 6],
  ],
  full_body: [],
};

export default function BodyPartIcon({ parts, className = 'h-full w-full' }: { parts: BodyPart[]; className?: string }) {
  const full = parts.includes('full_body');
  return (
    <svg viewBox="0 0 100 140" className={className} aria-hidden>
      <g fill={full ? '#14b8a6' : '#cbd5e1'}>
        <circle cx="50" cy="14" r="10" />
        <path d="M38 30h24a8 8 0 0 1 8 8l8 44a4 4 0 0 1-8 1.5L64 50v26l-3 60a5 5 0 0 1-10 0V96h-2v40a5 5 0 0 1-10 0l-3-60V50l-6 33.5A4 4 0 0 1 22 82l8-44a8 8 0 0 1 8-8z" />
      </g>
      {!full &&
        parts.flatMap((p) =>
          (SPOTS[p] ?? []).map(([cx, cy, r], i) => <circle key={`${p}-${i}`} cx={cx} cy={cy} r={r} fill="#0d9488" fillOpacity="0.85" />),
        )}
    </svg>
  );
}
