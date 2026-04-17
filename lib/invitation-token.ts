import { randomUUID } from 'crypto';

const INVITATION_TTL_HOURS = 48;

export function generateInvitationToken(): string {
  return randomUUID();
}

export function computeInvitationExpiry(): string {
  return new Date(Date.now() + INVITATION_TTL_HOURS * 3600 * 1000).toISOString();
}

export function isInvitationExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}
