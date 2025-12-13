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
 * 
 * Returns the suffix as hex string with 0x prefix for use with wagmi dataSuffix
 */
export const getBuilderCodeSuffix = (): `0x${string}` => {
  try {
    const suffix = Attribution.toDataSuffix({
      codes: [BUILDER_CODE]
    });
    console.log('[BuilderCode] Generated suffix:', suffix);
    return suffix as `0x${string}`;
  } catch (error) {
    console.error('[BuilderCode] Failed to generate suffix:', error);
    return '0x';
  }
};

// Pre-generate the suffix for efficiency
export const BUILDER_CODE_SUFFIX = getBuilderCodeSuffix();

console.log('[BuilderCode] Loyal Spark is using Base Builder Code:', BUILDER_CODE);
console.log('[BuilderCode] Suffix:', BUILDER_CODE_SUFFIX);
