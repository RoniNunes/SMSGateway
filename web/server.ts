import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { attachDeviceBroker } from './src/lib/device-broker';
import { appBaseUrl, serverHostname, serverPort, validateAppUrlPort } from './src/lib/env';

const dev = process.env.NODE_ENV !== 'production';
const hostname = serverHostname();
const port = serverPort();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '', true);
    handle(req, res, parsedUrl);
  });

  attachDeviceBroker(server);

  const publicUrl = appBaseUrl();
  const portWarning = validateAppUrlPort();

  server.listen(port, hostname, () => {
    console.log(`> SMS Gateway ready on http://localhost:${port}`);
    console.log(`> URL pública (QR/APK): ${publicUrl}`);
    if (portWarning) console.warn(`> ⚠ ${portWarning}`);
    console.log(`> Device WebSocket: ${publicUrl.replace(/^http/, 'ws')}/device/ws?device_token=...`);
    console.log(`> Device MQTT/WS:   ${publicUrl.replace(/^http/, 'ws')}/device/mqtt`);
  });
});