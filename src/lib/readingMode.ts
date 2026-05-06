export const DARK_READING_MODE_STORAGE_KEY = 'toeic_dark_reading_mode';

export function parseDarkReadingModePreference(value: string | null) {
  return value === 'true';
}
