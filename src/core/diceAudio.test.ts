import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeClatterImpulseSchedule,
  computeOutcomeAudioCue,
  isDiceAudioMuted,
  playDiceClatter,
  setDiceAudioMuted,
} from './diceAudio';

test('computeClatterImpulseSchedule scales tap count and strictly increases delays', () => {
  const single = computeClatterImpulseSchedule(1, () => 0.5);
  const pool = computeClatterImpulseSchedule(8, () => 0.5);

  assert.equal(single.length, 3);
  assert.equal(pool.length, 7);

  for (let i = 1; i < pool.length; i += 1) {
    assert.ok(pool[i].delaySec > pool[i - 1].delaySec);
    assert.ok(pool[i].gain > 0 && pool[i].gain < 0.2);
    assert.ok(pool[i].resonanceHz >= 300 && pool[i].resonanceHz <= 1200);
  }
  // Final settle tap is softer than the opening tap
  assert.ok(pool[pool.length - 1].gain < pool[0].gain);
});

test('computeOutcomeAudioCue selects critical, fumble, or none deterministically', () => {
  assert.equal(computeOutcomeAudioCue({ isCritical: true, isFumble: false }), 'critical');
  assert.equal(computeOutcomeAudioCue({ isCritical: false, isFumble: true }), 'fumble');
  assert.equal(computeOutcomeAudioCue({ isCritical: false, isFumble: false }), 'none');
  assert.equal(computeOutcomeAudioCue({ isCritical: true, isFumble: true }), 'critical');
});

test('setDiceAudioMuted updates mute state and playDiceClatter returns false safely', () => {
  setDiceAudioMuted(true);
  assert.equal(isDiceAudioMuted(), true);
  assert.equal(playDiceClatter({ diceCount: 4, isFumble: true }), false);

  setDiceAudioMuted(false);
  assert.equal(isDiceAudioMuted(), false);
  assert.equal(playDiceClatter({ diceCount: 4 }), false);
});
