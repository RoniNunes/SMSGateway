import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

const HASH_LEN = 6;

/** ID curto único por dispositivo (ex: A3F92K). */
export async function generateUniqueDeviceHash(): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const hash = randomBytes(3).toString('hex').slice(0, HASH_LEN).toUpperCase();
    const taken = await prisma.device.findFirst({
      where: { deviceHash: hash },
      select: { id: true },
    });
    if (!taken) return hash;
  }
  throw new Error('Não foi possível gerar o ID do dispositivo.');
}

export async function ensureDeviceHash(deviceId: number, current: string | null | undefined): Promise<string> {
  if (current) return current;
  const hash = await generateUniqueDeviceHash();
  await prisma.device.update({
    where: { id: deviceId },
    data: { deviceHash: hash },
  });
  return hash;
}