import { createReadStream, existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

export const APK_FILENAME = 'SMSGateway.apk';

export type ApkMeta = {
  version_name: string;
  version_code: number;
  built_at: string | null;
  download_filename: string;
  server_url: string | null;
};

export function apkPath(): string {
  return join(process.cwd(), 'public', APK_FILENAME);
}

function metaPath(): string {
  return join(process.cwd(), 'public', 'apk-meta.json');
}

export function readApkMeta(): ApkMeta {
  const fallbackVersion = process.env.APK_VERSION?.trim() || '0';
  const fallback: ApkMeta = {
    version_name: fallbackVersion,
    version_code: 0,
    built_at: null,
    download_filename: versionedApkFilename(fallbackVersion),
    server_url: null,
  };

  const path = metaPath();
  if (!existsSync(path)) return fallback;

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const versionName = String(raw.version_name ?? fallbackVersion).trim() || fallbackVersion;
    return {
      version_name: versionName,
      version_code: Number(raw.version_code ?? 0) || 0,
      built_at: raw.built_at ? String(raw.built_at) : null,
      download_filename: String(raw.download_filename ?? versionedApkFilename(versionName)),
      server_url: raw.server_url ? String(raw.server_url) : null,
    };
  } catch {
    return fallback;
  }
}

export function versionedApkFilename(versionName: string): string {
  const safe = versionName.replace(/[^0-9A-Za-z._-]/g, '') || '0';
  return `SMSGateway-v${safe}.apk`;
}

export function getApkInfo() {
  const path = apkPath();
  const meta = readApkMeta();
  const available = existsSync(path);

  if (!available) {
    return {
      available: false,
      filename: meta.download_filename,
      version_name: meta.version_name,
      version_code: meta.version_code,
      size_bytes: 0,
      size_human: null as string | null,
      updated_at: null as string | null,
      built_at: meta.built_at,
      download_url: '/download',
    };
  }

  const stat = statSync(path);
  const mb = stat.size / 1024 / 1024;

  return {
    available: true,
    filename: meta.download_filename,
    version_name: meta.version_name,
    version_code: meta.version_code,
    size_bytes: stat.size,
    size_human: `${mb.toFixed(1)} MB`,
    updated_at: stat.mtime.toISOString(),
    built_at: meta.built_at,
    download_url: '/download',
  };
}

export function streamApkDownload(): Response {
  const path = apkPath();
  if (!existsSync(path)) {
    return new Response('APK não disponível no servidor.', { status: 404 });
  }

  const meta = readApkMeta();
  const size = statSync(path).size;
  const stream = createReadStream(path);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  const downloadName = meta.download_filename;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Content-Length': String(size),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Apk-Version': meta.version_name,
      'X-Apk-Version-Code': String(meta.version_code),
    },
  });
}