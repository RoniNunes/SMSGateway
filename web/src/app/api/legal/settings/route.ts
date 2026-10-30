import { jsonOk } from '@/lib/api-response';
import { getLegalSettings } from '@/lib/legal-settings';

export async function GET() {
  const settings = await getLegalSettings();
  return jsonOk({
    status: 'success',
    data: {
      company: settings.company,
      dpo_email: settings.dpoEmail,
      address: settings.address,
      website: settings.website,
      country: settings.country,
      tax_id: settings.taxId,
      legal_representative: settings.legalRepresentative,
      jurisdiction: settings.jurisdiction,
      privacy_phone: settings.privacyPhone,
      legal_version: settings.legalVersion,
      legal_last_updated: settings.legalLastUpdated,
      source: settings.source,
    },
  });
}