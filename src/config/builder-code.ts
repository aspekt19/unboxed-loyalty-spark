import { Attribution } from 'ox/erc8021';

/**
 * Base Builder Code Configuration
 * 
 * This code is used to attribute onchain activity to the Loyal Spark app
 * and qualify for potential future rewards from Base.
 * 
 * Learn more: https://docs.base.org/base-chain/quickstart/builder-codes
 */
export const BUILDER_CODE = 'bc_wdmnog7m';

/**
 * Generate the data suffix for transaction attribution
 * This suffix is appended to transaction calldata to track
 * which transactions originated from this app.
 */
export const getBuilderCodeSuffix = (): string => {
  try {
    return Attribution.toDataSuffix({
      codes: [BUILDER_CODE]
    });
  } catch (error) {
    console.error('[BuilderCode] Failed to generate suffix:', error);
    return '';
  }
};

/**
 * Append builder code suffix to existing calldata
 * @param calldata - The original transaction calldata (hex string starting with 0x)
 * @returns The calldata with builder attribution suffix appended
 */
export const appendBuilderCodeToCalldata = (calldata: `0x${string}`): `0x${string}` => {
  const suffix = getBuilderCodeSuffix();
  if (!suffix) {
    return calldata;
  }
  // Remove '0x' prefix from suffix before appending
  return `${calldata}${suffix.slice(2)}` as `0x${string}`;
};

console.log('[BuilderCode] Loyal Spark is using Base Builder Code:', BUILDER_CODE);
