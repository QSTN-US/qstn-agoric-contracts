/**
 * @file Runtime address validation utilities
 *
 * These utilities provide additional validation for addresses beyond
 * the basic pattern matching done by type-guards.js
 */

import { isBech32Address } from '@agoric/orchestration/src/utils/address.js';
import { makeError, q } from '@endo/errors';

/**
 * EVM address pattern: 0x followed by 40 hexadecimal characters
 */
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validates an EVM address format
 *
 * @param {string} address - The address to validate
 * @returns {boolean} true if valid, false otherwise
 */
export const isValidEvmAddress = address => {
  return typeof address === 'string' && EVM_ADDRESS_PATTERN.test(address);
};

/**
 * Asserts that an EVM address is valid, throwing if not
 *
 * @param {string} address - The address to validate
 * @param {string} [context] - Optional context for error message
 * @throws {Error} if address is invalid
 */
export const assertValidEvmAddress = (address, context = 'EVM address') => {
  if (!isValidEvmAddress(address)) {
    throw makeError(
      `Invalid ${context}: must be 42-character hex string starting with 0x, got: ${address}`,
    );
  }
};

/**
 * Asserts that a Bech32 address is valid, throwing if not
 * Uses Agoric's built-in assertBech32Address validator
 *
 * @param {string} address - The address to validate
 * @param {string} [context] - Optional context for error message
 * @throws {Error} if address is invalid
 */
export const assertValidBech32Address = (
  address,
  context = 'Bech32 address',
) => {
  if (!isBech32Address(address)) {
    throw makeError(
      `Invalid ${context}: Expected a valid Bech32 address, got ${q(address)}`,
    );
  }
};

/**
 * Asserts that an Axelar GMP address is valid, throwing if not
 *
 * @param {string} address - The address to validate
 * @param {string} [context] - Optional context for error message
 * @throws {Error} if address is invalid
 */
export const assertValidAxelarGmpAddress = (
  address,
  context = 'Axelar GMP address',
) => {
  assertValidBech32Address(address, context);
  if (!address.startsWith('axelar1')) {
    throw makeError(
      `Invalid ${context}: must have axelar1 prefix, got: ${address}`,
    );
  }
};

/**
 * Validates all contract addresses in the privateArgs
 *
 * @param {object} contracts - Contract addresses map
 * @param {object} gmpAddresses - GMP addresses object
 * @throws {Error} if any address is invalid
 */
export const validatePrivateArgsAddresses = (contracts, gmpAddresses) => {
  // Validate EVM contract addresses
  const evmChains = ['Arbitrum', 'Avalanche', 'Base', 'Ethereum', 'Optimism'];
  for (const chain of evmChains) {
    if (contracts[chain]) {
      assertValidEvmAddress(
        contracts[chain].quizzler,
        `${chain} quizzler contract address`,
      );
    }
  }

  // Validate Cosmos contract addresses
  const cosmosChains = ['Osmosis', 'Neutron'];
  for (const chain of cosmosChains) {
    if (contracts[chain]) {
      assertValidBech32Address(
        contracts[chain].quizzler,
        `${chain} quizzler contract address`,
      );
    }
  }

  // Validate GMP addresses
  assertValidAxelarGmpAddress(gmpAddresses.AXELAR_GMP, 'AXELAR_GMP address');
  assertValidAxelarGmpAddress(gmpAddresses.AXELAR_GAS, 'AXELAR_GAS address');
};
