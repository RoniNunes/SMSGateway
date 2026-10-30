import LegalDocument from '@/components/LegalDocument';
import LegalFooter from '@/components/LegalFooter';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { TERMS_SECTIONS } from '@/lib/legal-config';
import { getLegalSettings } from '@/lib/legal-settings';

export default async function TermsPage() {
  const settings = await getLegalSettings();

  return (
    <div className="legal-page">
      <div className="legal-page-bar">
        <LocaleSwitcher compact />
      </div>
      <div className="legal-page-container">
        <LegalDocument type="terms" sections={TERMS_SECTIONS} settings={settings} />
      </div>
      <LegalFooter />
    </div>
  );
}