import { PairOpenApp } from '@/components/PairOpenApp';
import { resolveAppBaseUrl } from '@/lib/app-url';
import { pairingDeepLink, validatePublicPairing } from '@/lib/pairing';
import Link from 'next/link';

type Props = {
  searchParams: Promise<{ code?: string; sig?: string; name?: string; phone?: string }>;
};

export default async function PairPage({ searchParams }: Props) {
  const params = await searchParams;
  const code = (params.code ?? '').trim().toUpperCase();
  const sig = (params.sig ?? '').trim();
  const nameParam = (params.name ?? '').trim();
  const phoneParam = (params.phone ?? '').trim();

  const row = code && sig ? await validatePublicPairing(code, sig) : null;
  const valid = row !== null;

  const name = nameParam || row?.deviceName || 'Android';
  const phone = phoneParam || row?.phoneNumber || '';
  const panelServerUrl = await resolveAppBaseUrl();
  const deepLink = valid ? await pairingDeepLink(code, name, phone) : '';
  const apkUrl = valid
    ? `/pair_download.php?${new URLSearchParams({ code, sig }).toString()}`
    : '';
  const expiresAt = valid && row?.pairingExpires
    ? row.pairingExpires.toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
    : '';

  return (
    <div className="pair-page">
      <div className="pair-wrap">
        <div className="pair-card">
          <div className="pair-logo">SMS Gateway</div>
          <p className="pair-sub">Ligação automática do dispositivo Android</p>

          {!valid ? (
            <>
              <p className="pair-err">Link inválido ou expirado. Gere um novo código QR no painel web.</p>
              <Link className="btn btn-ghost pair-btn-block" href="/login" style={{ marginTop: 20 }}>
                Ir para o painel
              </Link>
            </>
          ) : (
            <>
              <div className="pair-badge">{code}</div>
              <div className="pair-server-url">
                Servidor: <strong>{panelServerUrl}</strong>
              </div>
              <p className="pair-legal" style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>
                Ao emparelhar, processamos identificadores do dispositivo e número de telefone conforme a{' '}
                <Link href="/privacy">Política de Privacidade</Link>.
              </p>
              <ol className="pair-steps">
                <li>
                  <strong>1.</strong> Se ainda não tem a app, descarregue o APK abaixo.
                </li>
                <li>
                  <strong>2.</strong> Toque em <strong>Abrir na app</strong> — o registo é automático.
                </li>
                <li>
                  <strong>3.</strong> Aceite as permissões de SMS no telefone.
                </li>
              </ol>

              <div className="pair-actions">
                <PairOpenApp deepLink={deepLink} />
                <a className="btn btn-ghost pair-btn-block" href={apkUrl}>
                  Descarregar APK
                </a>
              </div>
              <p id="pair-status" className="pair-status" />
              {expiresAt ? <p className="pair-hint">Código válido até {expiresAt}</p> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}