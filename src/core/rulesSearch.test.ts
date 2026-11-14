import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRulesSearchPrompt,
  extractGroundedSources,
  formatRulesSearchError,
  validateRulesQuery,
} from './rulesSearch';

test('validateRulesQuery rejects empty or overly long queries and trims valid ones', () => {
  assert.equal(validateRulesQuery('').ok, false);
  assert.equal(validateRulesQuery('a').ok, false);
  assert.equal(validateRulesQuery('x'.repeat(301)).ok, false);

  const valid = validateRulesQuery('  Frenzy difficulty  ');
  assert.equal(valid.ok, true);
  assert.equal(valid.query, 'Frenzy difficulty');
});

test('buildRulesSearchPrompt includes active RPG system context when provided', () => {
  const withSys = buildRulesSearchPrompt('Blood Surge', 'WORLD OF DARKNESS // STORYTELLER');
  assert.match(withSys, /WORLD OF DARKNESS \/\/ STORYTELLER/);
  assert.match(withSys, /Blood Surge/);

  const noSys = buildRulesSearchPrompt('Grapple rules');
  assert.match(noSys, /Grapple rules/);
});

test('extractGroundedSources deduplicates valid http/https sources and ignores unsafe schemes', () => {
  const sources = extractGroundedSources([
    { web: { uri: 'https://whitewolf.fandom.com/wiki/Frenzy', title: 'Frenzy | White Wolf Wiki' } },
    { web: { uri: 'https://whitewolf.fandom.com/wiki/Frenzy', title: 'Duplicate' } },
    { web: { uri: 'javascript:alert(1)', title: 'Bad' } },
    { web: { uri: 'https://wodcodex.com/wiki/Willpower' } },
  ]);

  assert.equal(sources.length, 2);
  assert.equal(sources[0].title, 'Frenzy | White Wolf Wiki');
  assert.equal(sources[1].title, 'wodcodex.com');
});

test('formatRulesSearchError converts raw quota and auth JSON errors into clean messages', () => {
  const quotaErr = formatRulesSearchError(
    '{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}',
  );
  assert.equal(quotaErr.status, 429);
  assert.doesNotMatch(quotaErr.message, /RESOURCE_EXHAUSTED|\{"error"/);

  const authErr = formatRulesSearchError('PERMISSION_DENIED: API key invalid');
  assert.equal(authErr.status, 502);
  assert.match(authErr.message, /GEMINI_API_KEY/);

  const genericJson = formatRulesSearchError(
    '{"error":{"code":500,"message":"Internal backend error https://example.com/docs"}}',
  );
  assert.equal(genericJson.status, 502);
  assert.doesNotMatch(genericJson.message, /https:\/\/example\.com/);
});

