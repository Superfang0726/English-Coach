import assert from 'node:assert/strict';
import { parseDarkReadingModePreference } from './readingMode.ts';

assert.equal(parseDarkReadingModePreference('true'), true);
assert.equal(parseDarkReadingModePreference('false'), false);
assert.equal(parseDarkReadingModePreference(null), false);
assert.equal(parseDarkReadingModePreference('unexpected'), false);

console.log('reading mode preference tests passed');
