import MerchantPage from './MerchantPage';

/**
 * Native Business App entry point.
 * Used when the app is built as the Business variant via Capacitor.
 * Renders MerchantPage directly without role selection.
 */
const NativeBusinessPage = () => {
  return <MerchantPage />;
};

export default NativeBusinessPage;
