/**
 * Utility helpers for the Loyal Spark application.
 *
 * @module utils
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS class names with intelligent conflict resolution.
 *
 * Combines `clsx` (conditional classes) with `tailwind-merge` (deduplication)
 * to produce a single, conflict-free class string.
 *
 * @param inputs - Class values (strings, arrays, objects, conditionals)
 * @returns Merged class string
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Ethereum hex address pattern (0x + 40 hex chars, case-insensitive) */
export const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/i;

/**
 * Validate whether a string is a valid Ethereum address.
 *
 * @param address - The string to validate
 * @returns `true` if the address matches the checksum-agnostic hex format
 */
export function isValidEthAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

/**
 * Truncate an Ethereum address for display purposes.
 *
 * @param address - Full hex address
 * @param startChars - Characters to keep at the start (default 6)
 * @param endChars - Characters to keep at the end (default 4)
 * @returns Truncated address like `0xAbCd...1234`
 */
export function truncateAddress(
  address: string,
  startChars = 6,
  endChars = 4,
): string {
  if (!address) return "";
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}
