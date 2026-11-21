import { useState } from 'react';
import type { BodyPart } from '../lib/bodyParts';
import BodyPartIcon from './BodyPartIcon';

/** Photo of the exercise, or a body-part pictogram when there is none (or it fails to load). */
export default function ExerciseThumb({ url, bodyParts, alt = '' }: { url: string | null | undefined; bodyParts: BodyPart[]; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-brand-50 p-2">
      <BodyPartIcon parts={bodyParts} />
    </div>
  );
}
