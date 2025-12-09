// TODO: move meta.name
import { orchPermit } from '../tools/orch.start.js';

export const name = /** @type {const} */ 'qstn';

/**
 * @import { BootstrapManifestPermit } from '@agoric/vats/src/core/lib-boot.js';
 */

/**
 * @satisfies {BootstrapManifestPermit}
 */
export const permit = /** @type {const} */ {
  produce: { [/** @type {const} */ `${name}Kit`]: true },
  consume: {
    ...orchPermit,
    chainInfoPublished: true,
    [/** @type {const} */ `${name}Kit`]: true,
  },
  instance: { produce: { [name]: true } },
  installation: { consume: { [name]: true } },
  brand: { consume: { BLD: true } },
  issuer: { consume: { BLD: true, IST: true } },
};
harden(permit);
