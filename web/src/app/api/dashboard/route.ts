import { getApkInfo } from '@/lib/apk';
import { jsonError, jsonOk } from '@/lib/api-response';
import { generateToken } from '@/lib/crypto';
import { prisma } from '@/lib/db';
import { getServerUrlSettings, savePublicServerUrl } from '@/lib/app-url';
import { createPairing } from '@/lib/pairing';
import { clearSession, requireUser } from '@/lib/session';
import {
  deleteDevice,
  listDevices,
  reconnectDevice,
  renameDevice,
  toggleDevice,
  updateDevicePhone,
} from '@/lib/services/devices';
import { getDashboardStats } from '@/lib/services/stats';
import { notifyUserDevices } from '@/lib/device-notify';
import { broadcastUser } from '@/lib/realtime-hub';
import { maskWebhookKey, sendSmsWebhook, userWebhookAllowed } from '@/lib/webhook';
import {
  deleteOwnAccount,
  deleteUserAccountFull,
  deleteWaitlistEntry,
  exportUserData,
  logDataRequest,
} from '@/lib/services/privacy';
import {
  changeOwnPassword,
  createUser,
  listUsersWithStats,
  updateOwnProfile,
} from '@/lib/services/users';
import { getLegalSettings, saveLegalSettings } from '@/lib/legal-settings';
import { listWaitlist } from '@/lib/services/waitlist';
import type { NextRequest } from 'next/server';
import { UserRole, type SmsQueueStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  return handleDashboard(req);
}

export async function POST(req: NextRequest) {
  return handleDashboard(req);
}

async function handleDashboard(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return jsonError('Não autenticado.', 401);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'stats';
  const uid = user.id;

  switch (action) {
    case 'me':
      return jsonOk({
        status: 'success',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          api_key: user.apiKey,
          role: user.role,
          is_admin: user.role === 'admin',
        },
      });

    case 'stats': {
      const stats = await getDashboardStats(uid);
      return jsonOk(stats);
    }

    case 'sms': {
      const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
      const limit = Math.min(50, Math.max(10, parseInt(url.searchParams.get('limit') ?? '20', 10)));
      const q = (url.searchParams.get('q') ?? '').trim();
      const sortBy = url.searchParams.get('sort_by') ?? 'received';
      const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';

      const orderBy =
        sortBy === 'phone'
          ? { phoneNum: order as 'asc' | 'desc' }
          : sortBy === 'date'
            ? { datestamp: order as 'asc' | 'desc' }
            : { recordStamp: order as 'asc' | 'desc' };

      const where = q
        ? {
            userId: uid,
            OR: [{ phoneNum: { contains: q } }, { message: { contains: q } }],
          }
        : { userId: uid };

      const [total, data] = await Promise.all([
        prisma.smsReceived.count({ where }),
        prisma.smsReceived.findMany({
          where,
          orderBy: [orderBy, { id: order as 'asc' | 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return jsonOk({
        data: data.map(mapSmsReceived),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        sort_by: sortBy,
        order,
      });
    }

    case 'sent': {
      const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
      const limit = Math.min(50, Math.max(10, parseInt(url.searchParams.get('limit') ?? '20', 10)));
      const status = url.searchParams.get('status') ?? 'all';
      const where =
        status === 'all'
          ? { userId: uid }
          : { userId: uid, status: status as SmsQueueStatus };

      const [total, data] = await Promise.all([
        prisma.smsQueue.count({ where }),
        prisma.smsQueue.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return jsonOk({
        data: data.map(mapSmsQueue),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    }

    case 'devices': {
      const data = await listDevices(uid);
      return jsonOk({ status: 'success', data });
    }

    case 'create_pairing': {
      const name = url.searchParams.get('device_name') ?? 'Android';
      const phone = url.searchParams.get('phone_number') ?? '';
      const result = await createPairing(uid, name, phone);
      broadcastUser(uid, 'devices', 'pairing.created', { pairing_code: result.pairingCode });
      return jsonOk({
        status: 'success',
        pairing_code: result.pairingCode,
        expires_in: result.expiresIn,
        id: result.device.id,
        device_hash: result.device.deviceHash,
        pairing_url: result.pairingUrl,
        deep_link: result.deepLink,
        signature: result.signature,
        apk_url: result.apkUrl,
      });
    }

    case 'toggle_device': {
      const id = parseInt(url.searchParams.get('id') ?? '0', 10);
      const active = url.searchParams.get('active') !== '0' && url.searchParams.get('active') !== 'false';
      if (id <= 0) return jsonError('ID inválido.', 400);

      const result = await toggleDevice(uid, id, active);
      if (!result.ok) return jsonError(result.error, 400);

      broadcastUser(uid, 'devices', 'device.updated', { id, active });
      broadcastUser(uid, 'stats', 'stats.changed', {});
      return jsonOk({ status: 'success', message: result.message });
    }

    case 'reconnect_device': {
      const id = parseInt(url.searchParams.get('id') ?? '0', 10);
      if (id <= 0) return jsonError('ID inválido.', 400);

      const result = await reconnectDevice(uid, id);
      if (!result.ok) return jsonError(result.error, 404);

      broadcastUser(uid, 'devices', 'device.reconnected', { id, pairing_code: result.pairingCode });
      return jsonOk({
        status: 'success',
        message: result.message,
        pairing_code: result.pairingCode,
        expires_in: result.expiresIn,
        pairing_url: result.pairingUrl,
        deep_link: result.deepLink,
        signature: result.signature,
        apk_url: result.apkUrl,
      });
    }

    case 'rename_device': {
      const id = parseInt(url.searchParams.get('id') ?? '0', 10);
      const deviceName = (url.searchParams.get('device_name') ?? '').trim();
      if (id <= 0) return jsonError('ID inválido.', 400);

      const result = await renameDevice(uid, id, deviceName);
      if (!result.ok) return jsonError(result.error, 400);

      broadcastUser(uid, 'devices', 'device.renamed', { id, device_name: result.device_name });
      return jsonOk({
        status: 'success',
        message: result.message,
        device_name: result.device_name,
        device_hash: result.device_hash,
      });
    }

    case 'update_device_phone': {
      const id = parseInt(url.searchParams.get('id') ?? '0', 10);
      const phoneNumber = (url.searchParams.get('phone_number') ?? '').trim();
      if (id <= 0) return jsonError('ID inválido.', 400);

      const result = await updateDevicePhone(uid, id, phoneNumber);
      if (!result.ok) return jsonError(result.error, 400);

      broadcastUser(uid, 'devices', 'device.phone_updated', { id, phone_number: result.phone_number });
      return jsonOk({
        status: 'success',
        message: result.message,
        phone_number: result.phone_number,
      });
    }

    case 'delete_device': {
      const id = parseInt(url.searchParams.get('id') ?? '0', 10);
      if (id <= 0) return jsonError('ID inválido.', 400);

      const result = await deleteDevice(uid, id);
      if (!result.ok) return jsonError(result.error, 404);

      broadcastUser(uid, 'devices', 'device.deleted', { id });
      broadcastUser(uid, 'stats', 'stats.changed', {});
      return jsonOk({ status: 'success', message: result.message });
    }

    case 'send': {
      const phone = url.searchParams.get('phone') ?? '';
      const msg = url.searchParams.get('msg') ?? '';
      if (!phone || !msg) return jsonError('Os campos phone e msg são obrigatórios.', 400);

      const row = await prisma.smsQueue.create({
        data: { userId: uid, phone, message: msg },
      });
      broadcastUser(uid, 'queue', 'queue.added', { id: row.id });
      broadcastUser(uid, 'stats', 'stats.changed', {});
      notifyUserDevices(uid, 'queue.pending', { id: row.id, phone, message: msg });

      return jsonOk({
        status: 'success',
        message: 'SMS na fila! O dispositivo Android enviará em breve.',
        id: row.id,
      });
    }

    case 'users': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const data = await listUsersWithStats();
      return jsonOk({ status: 'success', data });
    }

    case 'create_user': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const name = (url.searchParams.get('name') ?? '').trim();
      const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
      const password = url.searchParams.get('password') ?? '';
      const role = url.searchParams.get('role') === 'admin' ? UserRole.admin : UserRole.user;

      if (!name || !email || !password) {
        return jsonError('Nome, email e palavra-passe são obrigatórios.', 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonError('Email inválido.', 400);
      }
      if (password.length < 6) {
        return jsonError('A palavra-passe deve ter pelo menos 6 caracteres.', 400);
      }

      try {
        const created = await createUser({ name, email, password, role });
        return jsonOk({
          status: 'success',
          message: `Utilizador ${name} criado. Active a conta para permitir o login.`,
          id: created.id,
        });
      } catch (e) {
        return jsonError(e instanceof Error ? e.message : 'Erro ao criar utilizador.', 409);
      }
    }

    case 'toggle_user': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const targetId = parseInt(url.searchParams.get('id') ?? '0', 10);
      const active = url.searchParams.get('active') !== '0' && url.searchParams.get('active') !== 'false';

      if (targetId <= 0) return jsonError('ID inválido.', 400);
      if (targetId === uid && !active) {
        return jsonError('Não pode desactivar a sua própria conta.', 400);
      }

      await prisma.user.update({ where: { id: targetId }, data: { isActive: active } });
      return jsonOk({
        status: 'success',
        message: active ? 'Utilizador activado.' : 'Utilizador desactivado.',
      });
    }

    case 'delete_user': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const targetId = parseInt(url.searchParams.get('id') ?? '0', 10);
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
      const result = await deleteUserAccountFull(uid, targetId, { ip });
      if (!result.ok) return jsonError(result.error, targetId === uid ? 400 : 404);
      return jsonOk({ status: 'success', message: result.message });
    }

    case 'export_my_data': {
      const result = await exportUserData(uid);
      if (!result.ok) return jsonError(result.error, 404);
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
      await logDataRequest({ type: 'export', userId: uid, email: user.email, ip });
      return jsonOk({ status: 'success', export: result.data });
    }

    case 'delete_my_account': {
      let body: Record<string, unknown> = {};
      if (req.method === 'POST') {
        try {
          body = await req.json();
        } catch {
          body = {};
        }
      }
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
      const result = await deleteOwnAccount(
        uid,
        {
          password: String(body.password ?? url.searchParams.get('password') ?? ''),
          confirm: String(body.confirm ?? url.searchParams.get('confirm') ?? ''),
        },
        { ip, userAgent: req.headers.get('user-agent') ?? undefined },
      );
      if (!result.ok) return jsonError(result.error, 400);
      await clearSession();
      return jsonOk({ status: 'success', message: result.message });
    }

    case 'delete_waitlist_entry': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const entryId = parseInt(url.searchParams.get('id') ?? '0', 10);
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
      const result = await deleteWaitlistEntry(entryId, { ip });
      if (!result.ok) return jsonError(result.error, 404);
      return jsonOk({ status: 'success', message: result.message });
    }

    case 'update_profile': {
      const name = (url.searchParams.get('name') ?? '').trim();
      const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
      const result = await updateOwnProfile(uid, { name, email });
      if (!result.ok) return jsonError(result.error, 400);
      return jsonOk({
        status: 'success',
        message: 'Perfil actualizado.',
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      });
    }

    case 'change_password': {
      const currentPassword = url.searchParams.get('current_password') ?? '';
      const newPassword = url.searchParams.get('new_password') ?? '';
      const confirmPassword = url.searchParams.get('confirm_password') ?? '';

      if (newPassword !== confirmPassword) {
        return jsonError('A confirmação da nova palavra-passe não coincide.', 400);
      }

      const result = await changeOwnPassword(uid, { currentPassword, newPassword });
      if (!result.ok) return jsonError(result.error, 400);
      return jsonOk({ status: 'success', message: 'Palavra-passe alterada com sucesso.' });
    }

    case 'toggle_webhook_profile': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const targetId = parseInt(url.searchParams.get('id') ?? '0', 10);
      const enabled = url.searchParams.get('enabled') !== '0' && url.searchParams.get('enabled') !== 'false';

      if (targetId <= 0) return jsonError('ID inválido.', 400);

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) return jsonError('Utilizador não encontrado.', 404);
      if (target.role !== UserRole.user) {
        return jsonError('O perfil webhook só pode ser gerido para utilizadores (não administradores).', 400);
      }

      await prisma.user.update({
        where: { id: targetId, role: UserRole.user },
        data: { webhookEnabled: enabled },
      });

      return jsonOk({
        status: 'success',
        message: enabled ? 'Perfil webhook activado.' : 'Perfil webhook desactivado.',
      });
    }

    case 'webhook_settings': {
      if (!userWebhookAllowed(user)) {
        return jsonError('Perfil webhook desactivado. Contacte o administrador.', 403);
      }
      const fresh = await prisma.user.findUnique({ where: { id: uid } });
      return jsonOk({
        status: 'success',
        data: {
          webhook_url: fresh?.webhookUrl ?? '',
          webhook_api_key: maskWebhookKey(fresh?.webhookApiKey),
          webhook_auto: fresh?.webhookAuto ? 1 : 0,
          webhook_configured: !!(fresh?.webhookUrl ?? '').trim(),
        },
      });
    }

    case 'regenerate_api_key': {
      const newKey = generateToken(32);
      await prisma.user.update({ where: { id: uid }, data: { apiKey: newKey } });
      return jsonOk({ status: 'success', api_key: newKey });
    }

    case 'save_webhook': {
      if (!userWebhookAllowed(user)) {
        return jsonError('Perfil webhook desactivado.', 403);
      }
      const webhookUrl = url.searchParams.get('webhook_url') ?? '';
      const webhookKey = url.searchParams.get('webhook_api_key') ?? '';
      const auto = url.searchParams.get('webhook_auto') === '1' || url.searchParams.get('webhook_auto') === 'true';

      if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) {
        return jsonError('URL do webhook inválido.', 400);
      }

      const data: Record<string, unknown> = { webhookUrl, webhookAuto: auto };
      if (webhookKey && !webhookKey.includes('*')) {
        data.webhookApiKey = webhookKey;
      }
      await prisma.user.update({ where: { id: uid }, data });

      return jsonOk({ status: 'success', message: 'Configuração webhook guardada.' });
    }

    case 'test_webhook': {
      if (!userWebhookAllowed(user)) return jsonError('Perfil webhook desactivado.', 403);
      if (!user.webhookUrl) return jsonError('Configure o URL do webhook primeiro.', 400);

      const result = await sendSmsWebhook(user, {
        phoneNum: '+000000000',
        message: 'Teste SMSGateway — webhook n8n',
        datestamp: new Date(),
        recordStamp: new Date(),
      }, 'webhook_test');

      if (result.ok) {
        return jsonOk({ status: 'success', message: 'Webhook de teste enviado.', http_code: result.httpCode });
      }
      return jsonError(result.error ?? 'Falha no webhook', 502);
    }

    case 'server_settings': {
      const data = await getServerUrlSettings();
      return jsonOk({ status: 'success', data });
    }

    case 'save_server_url': {
      if (user.role !== UserRole.admin) {
        return jsonError('Acesso reservado a administradores.', 403);
      }
      const publicUrl = (url.searchParams.get('public_url') ?? '').trim();
      const result = await savePublicServerUrl(publicUrl);
      if (!result.ok) return jsonError(result.error, 400);
      return jsonOk({
        status: 'success',
        message: 'URL do servidor guardada. Novos QR codes usarão este domínio.',
        data: {
          public_url: result.public_url,
          effective_url: result.effective_url,
          source: 'database',
        },
      });
    }

    case 'apk_info': {
      return jsonOk({ status: 'success', data: getApkInfo() });
    }

    case 'waitlist': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const data = await listWaitlist();
      return jsonOk({ status: 'success', ...data });
    }

    case 'legal_settings': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      const data = await getLegalSettings();
      return jsonOk({
        status: 'success',
        data: {
          company_name: data.company,
          dpo_email: data.dpoEmail,
          address: data.address,
          country: data.country,
          tax_id: data.taxId,
          legal_representative: data.legalRepresentative,
          jurisdiction: data.jurisdiction,
          privacy_phone: data.privacyPhone,
          legal_version: data.legalVersion,
          legal_last_updated: data.legalLastUpdated,
          website: data.website,
          source: data.source,
        },
      });
    }

    case 'save_legal_settings': {
      if (user.role !== UserRole.admin) return jsonError('Acesso reservado a administradores.', 403);
      let body: Record<string, unknown> = {};
      if (req.method === 'POST') {
        try {
          body = await req.json();
        } catch {
          body = {};
        }
      }
      const result = await saveLegalSettings({
        companyName: String(body.company_name ?? url.searchParams.get('company_name') ?? ''),
        dpoEmail: String(body.dpo_email ?? url.searchParams.get('dpo_email') ?? ''),
        address: String(body.address ?? url.searchParams.get('address') ?? ''),
        country: String(body.country ?? url.searchParams.get('country') ?? ''),
        taxId: String(body.tax_id ?? url.searchParams.get('tax_id') ?? ''),
        legalRepresentative: String(
          body.legal_representative ?? url.searchParams.get('legal_representative') ?? '',
        ),
        jurisdiction: String(body.jurisdiction ?? url.searchParams.get('jurisdiction') ?? ''),
        privacyPhone: String(body.privacy_phone ?? url.searchParams.get('privacy_phone') ?? ''),
        bumpVersion:
          body.bump_version === true ||
          body.bump_version === 'true' ||
          url.searchParams.get('bump_version') === '1',
      });
      if (!result.ok) return jsonError(result.error, 400);
      return jsonOk({
        status: 'success',
        message: 'Dados legais guardados. As políticas públicas foram actualizadas.',
        data: {
          company_name: result.settings.company,
          dpo_email: result.settings.dpoEmail,
          address: result.settings.address,
          country: result.settings.country,
          tax_id: result.settings.taxId,
          legal_representative: result.settings.legalRepresentative,
          jurisdiction: result.settings.jurisdiction,
          privacy_phone: result.settings.privacyPhone,
          legal_version: result.settings.legalVersion,
          legal_last_updated: result.settings.legalLastUpdated,
          website: result.settings.website,
          source: result.settings.source,
        },
      });
    }

    case 'forward_webhook': {
      if (!userWebhookAllowed(user)) return jsonError('Perfil webhook desactivado.', 403);
      const smsId = parseInt(url.searchParams.get('id') ?? '0', 10);
      const sms = await prisma.smsReceived.findFirst({ where: { id: smsId, userId: uid } });
      if (!sms) return jsonError('SMS não encontrado.', 404);
      if (!user.webhookUrl) return jsonError('Configure o URL do webhook.', 400);

      const result = await sendSmsWebhook(user, sms, 'sms_forward');
      await prisma.smsReceived.update({
        where: { id: smsId },
        data: {
          webhookLastSent: new Date(),
          webhookLastStatus: result.ok ? 'sent' : 'failed',
          webhookLastError: result.ok ? null : (result.error ?? `HTTP ${result.httpCode ?? '?'}`),
        },
      });

      if (result.ok) return jsonOk({ status: 'success', message: 'SMS reenviado para o webhook.' });
      return jsonError(result.error ?? 'Falha ao reenviar', 502);
    }

    default:
      return jsonError('Acção inválida', 400);
  }
}

function mapSmsReceived(r: {
  id: number;
  userId: number | null;
  deviceId: number | null;
  userLabel: string;
  phoneNum: string;
  message: string;
  datestamp: Date;
  dateSent: Date;
  recordStamp: Date;
  webhookLastSent: Date | null;
  webhookLastStatus: string | null;
  webhookLastError: string | null;
}) {
  return {
    id: r.id,
    user_id: r.userId,
    device_id: r.deviceId,
    user: r.userLabel,
    phone_num: r.phoneNum,
    message: r.message,
    datestamp: r.datestamp,
    date_sent: r.dateSent,
    record_stamp: r.recordStamp,
    webhook_last_sent: r.webhookLastSent,
    webhook_last_status: r.webhookLastStatus,
    webhook_last_error: r.webhookLastError,
  };
}

function mapSmsQueue(r: {
  id: number;
  userId: number | null;
  deviceId: number | null;
  phone: string;
  message: string;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  errorMsg: string | null;
}) {
  return {
    id: r.id,
    user_id: r.userId,
    device_id: r.deviceId,
    phone: r.phone,
    message: r.message,
    status: r.status,
    created_at: r.createdAt,
    sent_at: r.sentAt,
    error_msg: r.errorMsg,
  };
}