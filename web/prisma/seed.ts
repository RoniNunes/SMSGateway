import { PrismaClient, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/** Mesmo hash bcrypt do PHP (admin123) */
const ADMIN_HASH =
  '$2y$10$OjvLtcJynhhkz7XZNj3vRuNjDst6V645HgOw2G4VNzhX2QhfcuNfu';

function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smsgateway.local' },
    update: {
      name: 'Admin',
      role: UserRole.admin,
      isActive: true,
      apiKey: generateApiKey(),
    },
    create: {
      name: 'Admin',
      email: 'admin@smsgateway.local',
      password: ADMIN_HASH,
      apiKey: generateApiKey(),
      role: UserRole.admin,
      isActive: true,
    },
  });

  await prisma.systemSettings.upsert({
    where: { id: 1 },
    create: { id: 1, publicUrl: '' },
    update: {},
  });

  console.log(`[seed] Admin: ${admin.email} (id=${admin.id})`);
  console.log('[seed] Password: admin123');
  console.log('[seed] Configure URL publica em Sistema (admin) ou APP_URL no .env');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());