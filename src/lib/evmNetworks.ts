import { Chain } from "viem";
import { mainnet, base, baseSepolia, polygon, arbitrum, optimism, bsc, avalanche } from "viem/chains";

export interface CustomChain extends Chain {
  iconUrl?: string;
}

/**
 * Предустановленные EVM сети
 */
export const DEFAULT_NETWORKS: CustomChain[] = [
  {
    ...baseSepolia,
    iconUrl: "https://avatars.githubusercontent.com/u/108554348?s=280&v=4",
  },
  {
    ...base,
    iconUrl: "https://avatars.githubusercontent.com/u/108554348?s=280&v=4",
  },
  {
    ...mainnet,
    iconUrl: "https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/81d9f/eth-diamond-black.png",
  },
  {
    ...polygon,
    iconUrl: "https://assets-global.website-files.com/637e2b6d602973ea0941d482/63e26c8a3f6e812d91a7aa3d_Polygon-0.png",
  },
  {
    ...arbitrum,
    iconUrl: "https://arbitrum.io/assets/arbitrum_logo.svg",
  },
  {
    ...optimism,
    iconUrl: "https://avatars.githubusercontent.com/u/35039927?s=280&v=4",
  },
  {
    ...bsc,
    iconUrl: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
  },
  {
    ...avalanche,
    iconUrl: "https://cryptologos.cc/logos/avalanche-avax-logo.png",
  },
];

/**
 * Сохранение выбранной сети
 */
export function saveSelectedNetwork(chainId: number) {
  localStorage.setItem('selected_network', chainId.toString());
}

/**
 * Получение выбранной сети
 */
export function getSelectedNetwork(): number {
  const saved = localStorage.getItem('selected_network');
  return saved ? parseInt(saved) : baseSepolia.id;
}

/**
 * Сохранение кастомных сетей
 */
export function saveCustomNetworks(networks: CustomChain[]) {
  localStorage.setItem('custom_networks', JSON.stringify(networks));
}

/**
 * Получение кастомных сетей
 */
export function getCustomNetworks(): CustomChain[] {
  const saved = localStorage.getItem('custom_networks');
  return saved ? JSON.parse(saved) : [];
}

/**
 * Добавление кастомной сети
 */
export function addCustomNetwork(network: CustomChain) {
  const networks = getCustomNetworks();
  // Проверяем, нет ли уже такой сети
  if (networks.find(n => n.id === network.id)) {
    throw new Error('Network already exists');
  }
  networks.push(network);
  saveCustomNetworks(networks);
}

/**
 * Удаление кастомной сети
 */
export function removeCustomNetwork(chainId: number) {
  const networks = getCustomNetworks();
  const filtered = networks.filter(n => n.id !== chainId);
  saveCustomNetworks(filtered);
}

/**
 * Получение всех доступных сетей
 */
export function getAllNetworks(): CustomChain[] {
  return [...DEFAULT_NETWORKS, ...getCustomNetworks()];
}

/**
 * Получение сети по chainId
 */
export function getNetworkById(chainId: number): CustomChain | undefined {
  return getAllNetworks().find(n => n.id === chainId);
}
