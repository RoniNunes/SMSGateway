import { prisma } from '@/lib/db';

export async function getDashboardStats(userId: number) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalSms,
    todaySms,
    totalDevices,
    uniqueNumbers,
    queuePending,
    queueSent,
    queueFailed,
    devices,
    recent,
  ] = await Promise.all([
    prisma.smsReceived.count({ where: { userId } }),
    prisma.smsReceived.count({ where: { userId, recordStamp: { gte: startOfToday } } }),
    prisma.device.count({ where: { userId, isActive: true } }),
    prisma.smsReceived.findMany({
      where: { userId },
      distinct: ['phoneNum'],
      select: { phoneNum: true },
    }),
    prisma.smsQueue.count({ where: { userId, status: 'pending' } }),
    prisma.smsQueue.count({ where: { userId, status: 'sent' } }),
    prisma.smsQueue.count({ where: { userId, status: 'failed' } }),
    prisma.device.findMany({
      where: { userId, isActive: true },
      select: { lastSeen: true },
      orderBy: { lastSeen: 'desc' },
    }),
    prisma.smsReceived.findMany({
      where: { userId },
      orderBy: { recordStamp: 'desc' },
      take: 5,
      select: {
        id: true,
        phoneNum: true,
        message: true,
        datestamp: true,
        recordStamp: true,
      },
    }),
  ]);

  const now = Date.now();
  let deviceOnline = false;
  let lastSeen: Date | null = null;
  let secondsSincePoll: number | null = null;

  for (const d of devices) {
    if (!d.lastSeen) continue;
    if (!lastSeen || d.lastSeen > lastSeen) lastSeen = d.lastSeen;
    const secs = Math.floor((now - d.lastSeen.getTime()) / 1000);
    if (secs <= 30) deviceOnline = true;
    if (secondsSincePoll === null || secs < secondsSincePoll) secondsSincePoll = secs;
  }

  return {
    total_sms: totalSms,
    today_sms: todaySms,
    total_devices: totalDevices,
    unique_numbers: uniqueNumbers.length,
    queue_pending: queuePending,
    queue_sent: queueSent,
    queue_failed: queueFailed,
    device_online: deviceOnline,
    device_last_seen: lastSeen,
    seconds_since_poll: secondsSincePoll,
    recent: recent.map((r) => ({
      id: r.id,
      phone_num: r.phoneNum,
      message: r.message,
      datestamp: r.datestamp,
      record_stamp: r.recordStamp,
    })),
    server_time: new Date().toLocaleString('pt-PT'),
  };
}