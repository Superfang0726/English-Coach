export const MAX_RETRY_ATTEMPTS = 10;

export function getRetryAttemptStatus(attemptedTimes: number) {
  const normalizedAttemptedTimes = Math.max(0, Math.min(attemptedTimes, MAX_RETRY_ATTEMPTS));

  return {
    attemptedTimes: normalizedAttemptedTimes,
    canRetryManually: normalizedAttemptedTimes >= MAX_RETRY_ATTEMPTS,
  };
}
