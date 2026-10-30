/**
 * Importa MySQL (PHP legado) → Prisma/SQLite
 *
 * Modo directo:
 *   MYSQL_URL=mysql://smsuser:pass@127.0.0.1:3306/smsgateway npm run db:import-mysql
 *
 * Modo Docker (MariaDB dentro do container all-in-one):
 *   DOCKER_CONTAINER=smsgateway-complete npm run db:import-mysql
 */
import { PrismaClient, SmsQueueStatus, UserRole, WebhookDeliveryStatus } from '@prisma/client';
import { execFile } from 'child_process';
import { promisify } from 'util';
import mysql from 'mysql2/promise';

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

const dockerContainer = (process.env.DOCKER_CONTAINER ?? 'smsgateway-complete').trim();
const mysqlUrl = process.env.MYSQL_URL?.trim();
const useDocker =
  process.env.IMPORT_VIA_DOCKER === '1' ||
  process.env.npm_lifecycle_event === 'db:import-docker' ||
  (!mysqlUrl && !!dockerContainer);

type Row = Record<string, unknown>;

function asDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asBool(v: unknown): boolean {
  return v === 1 || v === true || v === '1';
}

async function queryDocker(sql: string): Promise<Row[]> {
  const container = dockerContainer;
  const user = process.env.DB_USER || 'smsuser';
  const pass = process.env.DB_PASSWORD || 'smspassword';
  const db = process.env.DB_NAME || 'smsgateway';

  const { stdout } = await execFileAsync(
    'docker',
    ['exec', container, 'mariadb', `-u${user}`, `-p${pass}`, '-B', '-e', sql, db],
    { maxBuffer: 50 * 1024 * 1024 },
  );

  const lines = stdout.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cols = line.split('\t');
    const row: Row = {};
    headers.forEach((h, i) => {
      const v = cols[i] ?? '';
      row[h] = v === 'NULL' ? null : v;
    });
    return row;
  });
}

async function getConnection(): Promise<{ query: (sql: string) => Promise<Row[]>; close: () => Promise<void> }> {
  if (useDocker) {
    return {
      query: (sql) => queryDocker(sql),
      close: async () => {},
    };
  }
  if (!mysqlUrl) {
    throw new Error('Defina MYSQL_URL ou npm run db:import-docker');
  }
  const conn = await mysql.createConnection(mysqlUrl);
  return {
    query: async (sql: string) => {
      const [rows] = await conn.query<Row[]>(sql);
      return rows;
    },
    close: () => conn.end(),
  };
}

async function main() {
  const mode = useDocker ? `docker (${dockerContainer})` : 'mysql url';
  console.log(`[import] Modo: ${mode}`);

  const conn = await getConnection();

  const users = await conn.query('SELECT * FROM users ORDER BY id');
  console.log(`[import] users: ${users.length}`);
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: String(u.email) },
      update: {
        name: String(u.name),
        password: String(u.password),
        apiKey: u.api_key ? String(u.api_key) : null,
        role: String(u.role) === 'admin' ? UserRole.admin : UserRole.user,
        isActive: asBool(u.is_active),
        webhookEnabled: asBool(u.webhook_enabled),
        webhookUrl: u.webhook_url ? String(u.webhook_url) : null,
        webhookApiKey: u.webhook_api_key ? String(u.webhook_api_key) : null,
        webhookAuto: asBool(u.webhook_auto),
        createdAt: asDate(u.created_at) ?? new Date(),
      },
      create: {
        id: Number(u.id),
        name: String(u.name),
        email: String(u.email),
        password: String(u.password),
        apiKey: u.api_key ? String(u.api_key) : null,
        role: String(u.role) === 'admin' ? UserRole.admin : UserRole.user,
        isActive: asBool(u.is_active),
        webhookEnabled: asBool(u.webhook_enabled),
        webhookUrl: u.webhook_url ? String(u.webhook_url) : null,
        webhookApiKey: u.webhook_api_key ? String(u.webhook_api_key) : null,
        webhookAuto: asBool(u.webhook_auto),
        createdAt: asDate(u.created_at) ?? new Date(),
      },
    });
  }

  const devices = await conn.query('SELECT * FROM user_devices ORDER BY id');
  console.log(`[import] devices: ${devices.length}`);
  for (const d of devices) {
    await prisma.device.upsert({
      where: { id: Number(d.id) },
      update: {},
      create: {
        id: Number(d.id),
        userId: Number(d.user_id),
        deviceToken: d.device_token ? String(d.device_token) : null,
        pairingCode: d.pairing_code ? String(d.pairing_code) : null,
        pairingExpires: asDate(d.pairing_expires),
        deviceName: String(d.device_name ?? 'Android'),
        phoneNumber: String(d.phone_number ?? ''),
        lastSeen: asDate(d.last_seen),
        isActive: asBool(d.is_active),
        createdAt: asDate(d.created_at) ?? new Date(),
      },
    });
  }

  const received = await conn.query('SELECT * FROM sms_received ORDER BY id');
  console.log(`[import] sms_received: ${received.length}`);
  for (const s of received) {
    await prisma.smsReceived.upsert({
      where: { id: Number(s.id) },
      update: {},
      create: {
        id: Number(s.id),
        userId: s.user_id != null ? Number(s.user_id) : null,
        deviceId: s.device_id != null ? Number(s.device_id) : null,
        userLabel: String(s.user ?? ''),
        phoneNum: String(s.phone_num),
        message: String(s.message),
        datestamp: asDate(s.datestamp) ?? new Date(),
        dateSent: asDate(s.date_sent) ?? new Date(),
        recordStamp: asDate(s.record_stamp) ?? new Date(),
        webhookLastSent: asDate(s.webhook_last_sent),
        webhookLastStatus:
          s.webhook_last_status === 'sent'
            ? WebhookDeliveryStatus.sent
            : s.webhook_last_status === 'failed'
              ? WebhookDeliveryStatus.failed
              : null,
        webhookLastError: s.webhook_last_error ? String(s.webhook_last_error) : null,
      },
    });
  }

  const queue = await conn.query('SELECT * FROM sms_queue ORDER BY id');
  console.log(`[import] sms_queue: ${queue.length}`);
  for (const q of queue) {
    const status = String(q.status) as SmsQueueStatus;
    await prisma.smsQueue.upsert({
      where: { id: Number(q.id) },
      update: {},
      create: {
        id: Number(q.id),
        userId: q.user_id != null ? Number(q.user_id) : null,
        deviceId: q.device_id != null ? Number(q.device_id) : null,
        phone: String(q.phone),
        message: String(q.message),
        status: ['pending', 'sent', 'failed'].includes(status) ? status : SmsQueueStatus.pending,
        createdAt: asDate(q.created_at) ?? new Date(),
        sentAt: asDate(q.sent_at),
        errorMsg: q.error_msg ? String(q.error_msg) : null,
      },
    });
  }

  await conn.close();
  console.log('[import] Concluído → SQLite');
}

main()
  .catch((e) => {
    console.error('[import] ERRO:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());