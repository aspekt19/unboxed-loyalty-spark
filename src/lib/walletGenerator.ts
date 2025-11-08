import { generatePrivateKey, privateKeyToAccount, mnemonicToAccount, generateMnemonic, english } from "viem/accounts";
import { createPublicClient, http } from "viem";

/**
 * Генерация новой seed-фразы (12 слов)
 */
export function generateSeedPhrase(): string {
  return generateMnemonic(english);
}

/**
 * Генерация нового кошелька с seed-фразой
 */
export function generateWalletWithMnemonic() {
  const mnemonic = generateSeedPhrase();
  const account = mnemonicToAccount(mnemonic);
  
  return {
    address: account.address,
    privateKey: account.getHdKey().privateKey ? `0x${Buffer.from(account.getHdKey().privateKey!).toString('hex')}` : undefined,
    mnemonic: mnemonic,
  };
}

/**
 * Генерация нового кошелька (без seed-фразы)
 */
export function generateWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  return {
    address: account.address,
    privateKey: privateKey,
  };
}

/**
 * Восстановление кошелька из seed-фразы
 */
export function recoverFromMnemonic(mnemonic: string) {
  try {
    // Нормализуем: удаляем лишние пробелы, приводим к lowercase
    const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const account = mnemonicToAccount(normalizedMnemonic);
    
    return {
      address: account.address,
      privateKey: account.getHdKey().privateKey ? `0x${Buffer.from(account.getHdKey().privateKey!).toString('hex')}` : undefined,
      mnemonic: normalizedMnemonic,
    };
  } catch (error) {
    throw new Error("Invalid seed phrase");
  }
}

/**
 * Импорт кошелька из приватного ключа
 */
export function importWallet(privateKey: `0x${string}`) {
  try {
    const account = privateKeyToAccount(privateKey);
    return {
      address: account.address,
      privateKey: privateKey,
    };
  } catch (error) {
    throw new Error("Invalid private key");
  }
}

/**
 * Простое шифрование приватного ключа (XOR с паролем)
 * ВАЖНО: Это базовое шифрование для демонстрации. 
 * В продакшене используйте crypto-js или подобные библиотеки
 */
export function encryptPrivateKey(privateKey: string, password: string): string {
  const combined = privateKey.split('').map((char, i) => {
    const passwordChar = password.charCodeAt(i % password.length);
    return String.fromCharCode(char.charCodeAt(0) ^ passwordChar);
  }).join('');
  
  return btoa(combined); // Base64 encode
}

/**
 * Расшифровка приватного ключа
 */
export function decryptPrivateKey(encrypted: string, password: string): string {
  try {
    const combined = atob(encrypted);
    const privateKey = combined.split('').map((char, i) => {
      const passwordChar = password.charCodeAt(i % password.length);
      return String.fromCharCode(char.charCodeAt(0) ^ passwordChar);
    }).join('');
    
    return privateKey;
  } catch (error) {
    throw new Error("Invalid password or corrupted data");
  }
}

/**
 * Сохранение зашифрованного кошелька в localStorage
 */
export function saveEncryptedWallet(
  address: string, 
  encryptedKey: string, 
  encryptedMnemonic?: string
) {
  const wallets = JSON.parse(localStorage.getItem('encrypted_wallets') || '{}');
  wallets[address] = {
    key: encryptedKey,
    mnemonic: encryptedMnemonic,
  };
  localStorage.setItem('encrypted_wallets', JSON.stringify(wallets));
}

/**
 * Получение зашифрованного приватного ключа и mnemonic
 */
export function getEncryptedWallet(address: string): { key: string; mnemonic?: string } | null {
  const wallets = JSON.parse(localStorage.getItem('encrypted_wallets') || '{}');
  const wallet = wallets[address];
  
  // Поддержка старого формата (если кошелек был создан до обновления)
  if (typeof wallet === 'string') {
    return { key: wallet };
  }
  
  return wallet || null;
}

/**
 * Удаление кошелька
 */
export function deleteWallet(address: string) {
  const wallets = JSON.parse(localStorage.getItem('encrypted_wallets') || '{}');
  delete wallets[address];
  localStorage.setItem('encrypted_wallets', JSON.stringify(wallets));
}

/**
 * Получение всех сохраненных адресов
 */
export function getSavedWallets(): string[] {
  const wallets = JSON.parse(localStorage.getItem('encrypted_wallets') || '{}');
  return Object.keys(wallets);
}
