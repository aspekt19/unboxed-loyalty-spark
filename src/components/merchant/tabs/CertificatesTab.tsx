import { useState } from 'react';
import { CreateCertificate } from '@/components/certificates/CreateCertificate';
import { MerchantCertificatesList } from '@/components/certificates/MerchantCertificatesList';

export function CertificatesTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <CreateCertificate onCreated={() => setRefreshKey((k) => k + 1)} />
      <MerchantCertificatesList refreshKey={refreshKey} />
    </div>
  );
}
