export const errorMessages: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'Account already exists. Try logging in.',
  AUTH_OTP_INVALID: 'Invalid or expired code. Please try again.',
  VALIDATION_FAILED: 'Please check your input and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment.',
  AUTH_REFRESH_INVALID: 'Your session has expired. Please log in again.',
  AUTH_TOKEN_INVALID: 'Your session has expired. Please log in again.',
  INVALID_TAG: 'One or more selected tags are invalid. Filter cleared.',
  NOTE_NOT_FOUND: 'Note not found.',
  TAG_NAME_DUPLICATE: '',
  SEARCH_FAILED: 'Search failed. Please try again.',
  SHARE_NOT_FOUND: 'Share link not found.',
};

export function getErrorMessage(code: string | undefined): string {
  if (!code) return 'Something went wrong. Please try again.';
  return errorMessages[code] ?? 'Something went wrong. Please try again.';
}
