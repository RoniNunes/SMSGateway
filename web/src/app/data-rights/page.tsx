import DataRightsPanel from '@/components/DataRightsPanel';
import LegalFooter from '@/components/LegalFooter';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { getLegalSettings } from '@/lib/legal-settings';

export default async function DataRightsPage() {
  const settings = await getLegalSettings();

  return (
    <div className="legal-page">
      <div className="legal-page-bar">
        <LocaleSwitcher compact />
      </div>
      <div className="legal-page-container">
        <DataRightsPanel mode="public" dpoEmail={settings.dpoEmail} />
      </div>
      <LegalFooter />
    </div>
  );
}