import { OVER_24H_SECONDS } from '../lib/duration';

// Aula ao vivo há mais de 24 h quase sempre é aula esquecida aberta (#9, V05).
export default function OpenTooLongNotice({ elapsedSeconds }) {
  if (elapsedSeconds <= OVER_24H_SECONDS) return null;
  return (
    <div role="status" className="flex-shrink-0 px-6 py-2 bg-amber-100 text-amber-900 text-center text-sm font-medium">
      Aula aberta há mais de 24 horas. Encerre-a se ela já terminou.
    </div>
  );
}
