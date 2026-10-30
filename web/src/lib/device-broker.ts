import type { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import { createBroker } from 'aedes';

import { WebSocketServer, createWebSocketStream } from 'ws';
import { prisma } from '@/lib/db';
import {
  registerDeviceConnection,
  registerMqttPublisher,
  unregisterDeviceConnection,
} from '@/lib/device-notify';

type AedesClient = {
  id: string;
  userId?: number;
  deviceId?: number;
};

async function authDeviceToken(token: string) {
  if (!token) return null;
  const device = await prisma.device.findFirst({
    where: { deviceToken: token, isActive: true },
    select: { id: true, userId: true, deviceName: true },
  });
  return device;
}

function parseTokenFromUrl(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'http://localhost');
    return (parsed.searchParams.get('device_token') ?? '').trim();
  } catch {
    return '';
  }
}

export function attachDeviceBroker(server: HttpServer) {
  const broker = createBroker();

  registerMqttPublisher({
    publish: (topic, payload) => {
      broker.publish(
        { topic, payload: Buffer.from(payload), qos: 1, retain: false, cmd: 'publish', dup: false },
        () => undefined,
      );
    },
  });

  broker.authenticate = (client, username, _password, callback) => {
    void (async () => {
      const token = (username ?? '').trim();
      const device = await authDeviceToken(token);
      if (!device) {
        callback(null, false);
        return;
      }
      (client as AedesClient).userId = device.userId;
      (client as AedesClient).deviceId = device.id;
      callback(null, true);
    })();
  };

  const mqttWss = new WebSocketServer({ server, path: '/device/mqtt' });
  mqttWss.on('connection', (ws) => {
    const stream = createWebSocketStream(ws);
    broker.handle(stream);
  });

  const wsServer = new WebSocketServer({ server, path: '/device/ws' });

  wsServer.on('connection', (ws, req: IncomingMessage) => {
    void (async () => {
      const token = parseTokenFromUrl(req.url);
      const device = await authDeviceToken(token);
      if (!device) {
        ws.close(4401, 'Unauthorized');
        return;
      }

      const sendWs = (data: string) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      };

      registerDeviceConnection(token, {
        userId: device.userId,
        deviceId: device.id,
        sendWs,
      });

      sendWs(
        JSON.stringify({
          type: 'connected',
          user_id: device.userId,
          device_id: device.id,
          device_name: device.deviceName,
          topics: [`smsgw/u${device.userId}/queue`, `smsgw/u${device.userId}/auth`],
          transports: ['websocket', 'mqtt'],
          at: new Date().toISOString(),
        }),
      );

      ws.on('message', (raw) => {
        const text = String(raw);
        if (text === 'ping') {
          sendWs(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
        }
      });

      ws.on('close', () => unregisterDeviceConnection(token));
      ws.on('error', () => unregisterDeviceConnection(token));
    })();
  });

  return { broker, wsServer, mqttWss };
}