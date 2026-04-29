import { useState } from 'react';
import { CreateCertificate } from '@/components/certificates/CreateCertificate';
import { MerchantCertificatesList } from '@/components/certificates/MerchantCertificatesList';
import { ActivateCertificate } from '@/components/certificates/ActivateCertificate';

export function CertificatesTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);
  return (
    <div className="space-y-6">
      {/* Primary cashier action: scan/type customer's certificate */}
      <ActivateCertificate onActivated={bump} />
      {/* Issue new certificates */}
      <CreateCertificate onCreated={bump} />
      {/* History + manual mint button (fallback) */}
      <MerchantCertificatesList refreshKey={refreshKey} />
    </div>
  );
}
