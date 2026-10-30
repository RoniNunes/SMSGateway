export const PRIVACY_SECTIONS = [
  'introduction',
  'controller',
  'scope',
  'legalBases',
  'dataCollected',
  'purposes',
  'retention',
  'sharing',
  'internationalTransfers',
  'security',
  'rights',
  'children',
  'automatedDecisions',
  'changes',
  'contact',
] as const;

export const TERMS_SECTIONS = [
  'introduction',
  'service',
  'accounts',
  'acceptableUse',
  'smsContent',
  'devices',
  'api',
  'fees',
  'liability',
  'termination',
  'governingLaw',
  'changes',
  'contact',
] as const;

export const COOKIE_SECTIONS = [
  'introduction',
  'whatAreCookies',
  'cookiesWeUse',
  'legalBasis',
  'manage',
  'changes',
  'contact',
] as const;

export type LegalEntity = {
  company: string;
  dpoEmail: string;
  address: string;
  website: string;
};

import { createHash } from 'crypto';

export function hashIp(ip: string): string {
  const salt = process.env.SESSION_SECRET || 'smsgw-privacy-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}