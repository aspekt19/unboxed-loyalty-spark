import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";

/**
 * Генерация нового кошелька
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
export function saveEncryptedWallet(address: string, encryptedKey: string) {
  const wallets = JSON.parse(localStorage.getItem('encrypted_wallets') || '{}');
  wallets[address] = encryptedKey;
  localStorage.setItem('encrypted_wallets', JSON.stringify(wallets));
}

/**
 * Получение зашифрованного приватного ключа
 */
export function getEncryptedWallet(address: string): string | null {
  const wallets = JSON.parse(localStorage.getItem('encrypted_wallets') || '{}');
  return wallets[address] || null;
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
