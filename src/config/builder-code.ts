import { Attribution } from 'ox/erc8021';
import { encodeFunctionData } from 'viem';

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
export const getBuilderCodeSuffix = (): `0x${string}` => {
  try {
    const suffix = Attribution.toDataSuffix({
      codes: [BUILDER_CODE]
    });
    return suffix as `0x${string}`;
  } catch (error) {
    console.error('[BuilderCode] Failed to generate suffix:', error);
    return '0x';
  }
};

// Pre-generate the suffix for efficiency
export const BUILDER_CODE_SUFFIX = getBuilderCodeSuffix();

/**
 * Encode function data with Builder Code suffix appended
 * This is the correct way to add attribution when using writeContract/sendTransaction
 * as dataSuffix parameter only works with sendCalls
 */
export function encodeWithBuilderCode(
  abi: readonly unknown[],
  functionName: string,
  args?: readonly unknown[]
): `0x${string}` {
  const encoded = encodeFunctionData({
    abi: abi as any,
    functionName: functionName as any,
    args: args as any,
  });
  
  // Append suffix (remove 0x prefix from suffix since encoded already has it)
  const dataWithSuffix = (encoded + BUILDER_CODE_SUFFIX.slice(2)) as `0x${string}`;
  
  console.log('[BuilderCode] Encoded with suffix:', {
    functionName,
    suffix: BUILDER_CODE_SUFFIX,
  });
  
  return dataWithSuffix;
}

console.log('[BuilderCode] Loyal Spark using Base Builder Code:', BUILDER_CODE);
console.log('[BuilderCode] Suffix:', BUILDER_CODE_SUFFIX);
