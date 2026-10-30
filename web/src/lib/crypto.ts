import { createHmac, randomBytes } from 'crypto';

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function generatePairingCode(): string {
  return randomBytes(4).toString('hex').slice(0, 8).toUpperCase();
}

export function pairingSignature(code: string): string {
  const secret = process.env.PAIRING_SECRET || process.env.MIGRATE_KEY || 'setup2026';
  return createHmac('sha256', secret).update(code.trim().toUpperCase()).digest('hex').slice(0, 16);
}

export function pairingVerifySig(code: string, sig: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized || !sig || normalized.length !== 8) return false;
  const expected = pairingSignature(normalized);
  return expected === sig.trim().toLowerCase();
}