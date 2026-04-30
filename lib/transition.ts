type TransitionResult =
  | { notify: true; type: 'incident' }
  | { notify: true; type: 'recovery' }
  | { notify: false };

export function detectTransition(
  from: string | null,
  to: string,
): TransitionResult {
  if (from === null || from === 'loading') return { notify: false };
  if (from === to) return { notify: false };

  const isIncident = (s: string) => s !== 'operational';

  if (from === 'operational' && isIncident(to)) return { notify: true, type: 'incident' };
  if (isIncident(from) && to === 'operational') return { notify: true, type: 'recovery' };

  return { notify: false };
}
