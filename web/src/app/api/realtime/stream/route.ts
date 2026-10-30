import { subscribe, type RealtimeChannel, type RealtimeEvent } from '@/lib/realtime-hub';
import { requireUser } from '@/lib/session';
import { getDashboardStats } from '@/lib/services/stats';
import { listDevices } from '@/lib/services/devices';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_MS = 3000;

export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const channels = new Set(
    (url.searchParams.get('channels') ?? 'stats,sms,queue,devices')
      .split(',')
      .map((c) => c.trim()) as RealtimeChannel[],
  );

  const encoder = new TextEncoder();
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('connected', {
        channels: [...channels],
        userId: user.id,
        at: new Date().toISOString(),
      });

      const pushSnapshot = async () => {
        try {
          if (channels.has('stats')) {
            send('stats', await getDashboardStats(user.id));
          }
          if (channels.has('devices')) {
            send('devices', await listDevices(user.id));
          }
          if (channels.has('queue')) {
            const pending = await prisma.smsQueue.count({
              where: { userId: user.id, status: 'pending' },
            });
            send('queue', { pending, at: new Date().toISOString() });
          }
          if (channels.has('sms')) {
            const latest = await prisma.smsReceived.findFirst({
              where: { userId: user.id },
              orderBy: { recordStamp: 'desc' },
              select: { id: true, phoneNum: true, message: true, recordStamp: true },
            });
            send('sms.heartbeat', { latest, at: new Date().toISOString() });
          }
        } catch {
          send('system', { type: 'snapshot_error' });
        }
      };

      await pushSnapshot();

      unsubscribe = subscribe((evt: RealtimeEvent) => {
        if (evt.userId && evt.userId !== user.id) return;
        if (!channels.has(evt.channel)) return;
        send(`${evt.channel}.${evt.type}`, evt.payload ?? { at: evt.at });
      });

      pollTimer = setInterval(() => {
        void pushSnapshot();
      }, POLL_MS);

      req.signal.addEventListener('abort', () => {
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}