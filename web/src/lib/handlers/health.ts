import { prisma } from '@/lib/db';
import { jsonOk } from '@/lib/api-response';
import { getServerUrlSettings } from '@/lib/app-url';
import { API_PATHS } from '@/lib/api-paths';
import { serverPort, validateAppUrlPort } from '@/lib/env';
import { apkPath, APK_FILENAME, readApkMeta } from '@/lib/apk';
import { existsSync } from 'fs';

export async function handleHealth() {
  let database: string = 'error';
  let smsCount = 0;

  try {
    smsCount = await prisma.smsReceived.count();
    database = 'connected';
  } catch (e) {
    database = `error: ${e instanceof Error ? e.message : 'unknown'}`;
  }

  const apkFile = apkPath();
  const apkMeta = readApkMeta();
  const urlSettings = await getServerUrlSettings();

  return jsonOk(
    {
      service: 'SMSGateway API',
      version: '4.0.0-next',
      stack: 'nextjs+prisma+sqlite',
      timestamp: new Date().toISOString(),
      database,
      sms_count: smsCount,
      port: serverPort(),
      app_url: urlSettings.effective_url,
      app_url_source: urlSettings.source,
      config_warning: validateAppUrlPort(),
      apk: existsSync(apkFile) ? 'available' : 'missing',
      apk_download: existsSync(apkFile) ? API_PATHS.download : null,
      apk_filename: apkMeta.download_filename,
      apk_version: apkMeta.version_name,
      apk_version_code: apkMeta.version_code,
      apk_storage_name: APK_FILENAME,
      pairing: 'enabled',
      endpoints: {
        health: API_PATHS.health,
        api: API_PATHS.v1,
        download: API_PATHS.download,
      },
    },
    database === 'connected' ? 200 : 503,
  );
}