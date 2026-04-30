import { describe, it, expect } from 'vitest';
import { detectTransition } from '@/lib/transition';

describe('detectTransition', () => {
  it('TC-TR-01: operational → major_outage → incident', () => {
    expect(detectTransition('operational', 'major_outage')).toEqual({ notify: true, type: 'incident' });
  });

  it('TC-TR-02: operational → degraded → incident', () => {
    expect(detectTransition('operational', 'degraded')).toEqual({ notify: true, type: 'incident' });
  });

  it('TC-TR-03: operational → partial_outage → incident', () => {
    expect(detectTransition('operational', 'partial_outage')).toEqual({ notify: true, type: 'incident' });
  });

  it('TC-TR-04: operational → unknown → incident', () => {
    expect(detectTransition('operational', 'unknown')).toEqual({ notify: true, type: 'incident' });
  });

  it('TC-TR-05: major_outage → operational → recovery', () => {
    expect(detectTransition('major_outage', 'operational')).toEqual({ notify: true, type: 'recovery' });
  });

  it('TC-TR-06: degraded → operational → recovery', () => {
    expect(detectTransition('degraded', 'operational')).toEqual({ notify: true, type: 'recovery' });
  });

  it('TC-TR-07: degraded → major_outage → no notify', () => {
    expect(detectTransition('degraded', 'major_outage')).toEqual({ notify: false });
  });

  it('TC-TR-08: partial_outage → degraded → no notify', () => {
    expect(detectTransition('partial_outage', 'degraded')).toEqual({ notify: false });
  });

  it('TC-TR-09: operational → operational → no notify', () => {
    expect(detectTransition('operational', 'operational')).toEqual({ notify: false });
  });

  it('TC-TR-10: major_outage → major_outage → no notify', () => {
    expect(detectTransition('major_outage', 'major_outage')).toEqual({ notify: false });
  });

  it('TC-TR-11: null → operational → no notify (cold start)', () => {
    expect(detectTransition(null, 'operational')).toEqual({ notify: false });
  });

  it('TC-TR-12: null → major_outage → no notify (cold start)', () => {
    expect(detectTransition(null, 'major_outage')).toEqual({ notify: false });
  });

  it('TC-TR-13: loading → operational → no notify (initial load)', () => {
    expect(detectTransition('loading', 'operational')).toEqual({ notify: false });
  });
});
