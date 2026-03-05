const FRIENDLY_BY_CODE: Record<string, string> = {
  OWNER_NOT_ASSIGNED_TO_BUSINESS: 'Your account is not assigned to this business. Contact support.',
  OWNER_HAS_NO_BUSINESSES: 'Your account has no assigned business yet. Contact support.',
  OWNERSHIP_QUERY_FAILED: 'Unable to verify access right now. Please try again shortly.',
  BOOKING_REQUEST_INVALID: 'Please check your booking details and try again.',
  CHAT_REQUEST_INVALID: 'I could not understand that message. Please try again in a simpler format.'
};

export function friendlyError(input: { code?: string; error?: string }): string {
  if (input.code && FRIENDLY_BY_CODE[input.code]) return FRIENDLY_BY_CODE[input.code];
  return input.error || 'Something went wrong. Please try again.';
}
