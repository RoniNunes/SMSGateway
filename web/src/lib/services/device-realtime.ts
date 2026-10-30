import { broadcastUser } from '@/lib/realtime-hub';
import { listDevices } from '@/lib/services/devices';
import type { Device } from '@prisma/client';

export async function pushDevicesSnapshot(userId: number) {
  const data = await listDevices(userId);
  broadcastUser(userId, 'devices', 'snapshot', data);
  return data;
}

export async function notifyDeviceRegistered(
  userId: number,
  device: Pick<Device, 'id' | 'deviceName' | 'phoneNumber' | 'deviceHash'>,
) {
  broadcastUser(userId, 'devices', 'registered', {
    device_id: device.id,
    device_hash: device.deviceHash ?? '',
    device_name: device.deviceName,
    phone_number: device.phoneNumber,
    at: new Date().toISOString(),
  });
  await pushDevicesSnapshot(userId);
  broadcastUser(userId, 'stats', 'stats.changed', {});
}