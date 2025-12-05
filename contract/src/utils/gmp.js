/**
 * @import {Bech32Address} from '@agoric/orchestration';
 */

export const axelarGmpMessageType = /** @type {const} */ ({
  MESSAGE_ONLY: 1,
  MESSAGE_WITH_TOKEN: 2,
  TOKEN_ONLY: 3,
});
harden(axelarGmpMessageType);

/** @type {{ AXELAR_GMP: Bech32Address, AXELAR_GAS: Bech32Address, OSMOSIS_RECEIVER: Bech32Address }} */
export const gmpAddresses = {
  AXELAR_GMP:
    'axelar1dv4u5k73pzqrxlzujxg3qp8kvc3pje7jtdvu72npnt5zhq05ejcsn5qme5',
  AXELAR_GAS: 'axelar1zl3rxpp70lmte2xr6c4lgske2fyuj3hupcsvcd',
  OSMOSIS_RECEIVER: 'osmo1yh3ra8eage5xtr9a3m5utg6mx0pmqreytudaqj',
};
