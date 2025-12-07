import { makeError } from '@endo/errors';
import { encodeAbiParameters, hexToBytes } from 'viem';

/**
 * @import {EvmPayload, HexAddress} from './types.js';
 */

export const axelarGmpMessageType = /** @type {const} */ ({
  MESSAGE_ONLY: 1,
  MESSAGE_WITH_TOKEN: 2,
  TOKEN_ONLY: 3,
});
harden(axelarGmpMessageType);

export const MSG_IDS = /** @type {const} */ ({
  CREATE_SURVEY_MSG_ID: 0,
  CANCEL_SURVEY_MSG_ID: 1,
  PAY_REWARDS_MSG_ID: 2,
});
/**
 * Builds a GMP payload from an evm payload
 *
 * @param {EvmPayload} payload - evm payload
 * @returns {Array<number>} The GMP payload object
 */
export const buildGMPPayload = payload => {
  const { msg } = payload;

  /** @type {HexAddress} */
  let abiEncodedData;

  if ('create_survey' in msg) {
    const {
      signature,
      token,
      timeToExpire,
      owner,
      surveyId,
      participantsLimit,
      rewardAmount,
      surveyHash,
    } = msg.create_survey;

    abiEncodedData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'bytes' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      [
        BigInt(MSG_IDS.CREATE_SURVEY_MSG_ID),
        signature,
        token,
        BigInt(timeToExpire),
        owner,
        surveyId,
        BigInt(participantsLimit),
        BigInt(rewardAmount),
        surveyHash,
      ],
    );
  } else if ('cancel_survey' in msg) {
    const { signature, token, timeToExpire, surveyId } = msg.cancel_survey;

    abiEncodedData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'bytes' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'string' },
      ],
      [
        BigInt(MSG_IDS.CANCEL_SURVEY_MSG_ID),
        signature,
        token,
        BigInt(timeToExpire),
        surveyId,
      ],
    );
  } else if ('pay_rewards' in msg) {
    const { signature, token, timeToExpire, surveyIds, participants } =
      msg.pay_rewards;

    abiEncodedData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'bytes' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'string[]' },
        { type: 'string[]' },
      ],
      [
        BigInt(MSG_IDS.PAY_REWARDS_MSG_ID),
        signature,
        token,
        BigInt(timeToExpire),
        surveyIds,
        participants,
      ],
    );
  } else {
    throw makeError('Invalid EVM payload: unknown message type');
  }

  return Array.from(hexToBytes(abiEncodedData));
};
