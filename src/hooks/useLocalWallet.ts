import { useState, useEffect } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { 
  getSavedWallets, 
  getEncryptedWallet, 
  decryptPrivateKey 
} from "@/lib/walletGenerator";

interface LocalWallet {
  address: string;
  account: ReturnType<typeof privateKeyToAccount> | null;
}

/**
 * Hook для работы с локально сохраненным кошельком
 */
export function useLocalWallet() {
  const [localWallet, setLocalWallet] = useState<LocalWallet | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Проверяем наличие сохраненного кошелька при загрузке
  useEffect(() => {
    const wallets = getSavedWallets();
    if (wallets.length > 0) {
      // Берем первый кошелек (можно расширить для мультиаккаунта)
      const address = wallets[0];
      setLocalWallet({ address, account: null });
    }
  }, []);

  /**
   * Разблокировать кошелек с паролем
   */
  const unlockWallet = async (password: string): Promise<boolean> => {
    if (!localWallet) return false;
    
    setIsUnlocking(true);
    setError(null);

    try {
      const encryptedData = getEncryptedWallet(localWallet.address);
      if (!encryptedData) {
        throw new Error("Wallet data not found");
      }

      const privateKey = decryptPrivateKey(encryptedData.key, password);
      const account = privateKeyToAccount(privateKey as `0x${string}`);

      setLocalWallet({
        address: account.address,
        account: account,
      });

      setIsUnlocking(false);
      return true;
    } catch (err) {
      setError("Invalid password");
      setIsUnlocking(false);
      return false;
    }
  };

  /**
   * Заблокировать кошелек (удалить account из памяти)
   */
  const lockWallet = () => {
    if (localWallet) {
      setLocalWallet({
        address: localWallet.address,
        account: null,
      });
    }
  };

  return {
    localWallet,
    hasLocalWallet: !!localWallet,
    isUnlocked: !!(localWallet?.account),
    unlockWallet,
    lockWallet,
    isUnlocking,
    error,
  };
}
