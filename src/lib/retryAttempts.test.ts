import assert from 'node:assert/strict';
import { getRetryAttemptStatus, MAX_RETRY_ATTEMPTS } from './retryAttempts.ts';

assert.deepEqual(getRetryAttemptStatus(0), {
  attemptedTimes: 0,
  canRetryManually: false,
});

assert.deepEqual(getRetryAttemptStatus(1), {
  attemptedTimes: 1,
  canRetryManually: false,
});

assert.deepEqual(getRetryAttemptStatus(MAX_RETRY_ATTEMPTS - 1), {
  attemptedTimes: 9,
  canRetryManually: false,
});

assert.deepEqual(getRetryAttemptStatus(MAX_RETRY_ATTEMPTS), {
  attemptedTimes: 10,
  canRetryManually: true,
});

assert.deepEqual(getRetryAttemptStatus(MAX_RETRY_ATTEMPTS + 1), {
  attemptedTimes: 10,
  canRetryManually: true,
});

console.log('retry attempt tests passed');
