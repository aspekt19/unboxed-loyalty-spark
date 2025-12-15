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
    console.log('[BuilderCode] Generated suffix for code:', BUILDER_CODE, '→', suffix);
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
  
  // Check if suffix is valid
  if (!BUILDER_CODE_SUFFIX || BUILDER_CODE_SUFFIX === '0x') {
    console.error('[BuilderCode] Invalid suffix, returning original calldata');
    return encoded;
  }
  
  // Append suffix (remove 0x prefix from suffix since encoded already has it)
  const suffixWithout0x = BUILDER_CODE_SUFFIX.slice(2);
  const dataWithSuffix = (encoded + suffixWithout0x) as `0x${string}`;
  
  console.log('[BuilderCode] Transaction encoding:', {
    functionName,
    originalDataLength: encoded.length,
    suffixLength: suffixWithout0x.length,
    finalDataLength: dataWithSuffix.length,
    suffix: BUILDER_CODE_SUFFIX,
    // Show last 64 chars to verify suffix is appended
    dataEnding: dataWithSuffix.slice(-64),
  });
  
  return dataWithSuffix;
}

// Verify suffix format on load
console.log('[BuilderCode] Loyal Spark Builder Code:', BUILDER_CODE);
console.log('[BuilderCode] Full suffix (hex):', BUILDER_CODE_SUFFIX);
console.log('[BuilderCode] Suffix length (bytes):', BUILDER_CODE_SUFFIX ? (BUILDER_CODE_SUFFIX.length - 2) / 2 : 0);
