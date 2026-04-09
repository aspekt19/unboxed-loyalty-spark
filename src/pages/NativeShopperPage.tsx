import CustomerPage from './CustomerPage';

/**
 * Native Shopper App entry point.
 * Used when the app is built as the Shopper variant via Capacitor.
 * Renders CustomerPage directly without role selection.
 */
const NativeShopperPage = () => {
  return <CustomerPage />;
};

export default NativeShopperPage;
