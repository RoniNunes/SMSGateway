export type DeviceEventType = 'queue.pending' | 'auth.revoked' | 'ping';

export interface DeviceEvent {
  type: DeviceEventType;
  userId: number;
  deviceId?: number;
  payload?: unknown;
  at: string;
}

type MqttPublisher = {
  publish: (topic: string, payload: string) => void;
};

type WsSender = (data: string) => void;

type DeviceConnection = {
  userId: number;
  deviceId: number;
  sendWs: WsSender;
};

const globalHub = globalThis as unknown as {
  __deviceConnections?: Map<string, DeviceConnection>;
  __mqttPublisher?: MqttPublisher;
};

function connections(): Map<string, DeviceConnection> {
  if (!globalHub.__deviceConnections) {
    globalHub.__deviceConnections = new Map();
  }
  return globalHub.__deviceConnections;
}

export function registerMqttPublisher(publisher: MqttPublisher) {
  globalHub.__mqttPublisher = publisher;
}

export function registerDeviceConnection(token: string, conn: DeviceConnection) {
  connections().set(token, conn);
}

export function unregisterDeviceConnection(token: string) {
  connections().delete(token);
}

function userTopic(userId: number, suffix: string) {
  return `smsgw/u${userId}/${suffix}`;
}

function buildEvent(type: DeviceEventType, userId: number, payload?: unknown, deviceId?: number): DeviceEvent {
  return {
    type,
    userId,
    deviceId,
    payload,
    at: new Date().toISOString(),
  };
}

function publishEvent(event: DeviceEvent) {
  const json = JSON.stringify(event);

  for (const conn of connections().values()) {
    if (conn.userId === event.userId) {
      try {
        conn.sendWs(json);
      } catch {
        /* ignore broken socket */
      }
    }
  }

  const mqtt = globalHub.__mqttPublisher;
  if (mqtt) {
    const topic = userTopic(event.userId, event.type.startsWith('auth') ? 'auth' : 'queue');
    mqtt.publish(topic, json);
  }
}

export function notifyUserDevices(
  userId: number,
  type: DeviceEventType,
  payload?: unknown,
  deviceId?: number,
) {
  publishEvent(buildEvent(type, userId, payload, deviceId));
}

export function notifyDeviceRevoked(userId: number, deviceId: number, reason: string) {
  notifyUserDevices(userId, 'auth.revoked', { device_id: deviceId, reason }, deviceId);
}