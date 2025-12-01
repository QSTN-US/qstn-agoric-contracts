/// <reference types="@agoric/vats/src/core/types-ambient"/>
/**
 * @file Start QSTN Router
 *
 * This proposal starts the QSTN Router contract with pausable functionality.
 */

import { E } from '@endo/far';
import {
  deeplyFulfilledObject,
  makeTracer,
  NonNullish,
} from '@agoric/internal';

import '@agoric/governance/src/types.js';

/**
 * @import {Issuer} from '@agoric/ertp';
 * @import {ZoeService} from '@agoric/zoe/src/zoeService/types.js';
 * @import {IssuerKeywordRecord} from '@agoric/zoe/src/types.js';
 * @import {Installation, Instance} from '@agoric/zoe/src/zoeService/utils.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {start as routerStartFn} from '../qstn.router.governance.js';
 * @import {QstnBootstrapSpace} from '../../utils/types.js';
 */

const instanceName = 'QstnRouter';
const storagePath = 'QstnRouter';

const trace = makeTracer(instanceName);

const CONTRACT_ELECTORATE = 'Electorate';
const ParamTypes = {
  INVITATION: 'invitation',
};

/**
 * @template {GovernableStartFn} SF
 * @param {{
 *   zoe: ERef<ZoeService>;
 *   governedContractInstallation:  Promise<Installation<import('../qstn.router.governance.js')['start']>>;
 *   issuerKeywordRecord: IssuerKeywordRecord;
 *   terms: Record<string, unknown>;
 *   privateArgs: any; // TODO: connect with Installation type
 *   label: string;
 * }} zoeArgs
 * @param {{
 *   governedParams: Record<string, unknown>;
 *   timer: ERef<import('@agoric/time/src/types').TimerService>;
 *   contractGovernor: Promise<Installation<import('@agoric/governance/src/contractGovernor.js')['start']>>,
 *   committeeCreator: import('@agoric/inter-protocol/src/proposals/econ-behaviors.js').EconomyBootstrapPowers['consume']['economicCommitteeCreatorFacet'];
 * }} govArgs
 * @returns {Promise<GovernanceFacetKit<SF>>}
 */
const startGovernedInstance = async (
  {
    zoe,
    governedContractInstallation,
    issuerKeywordRecord,
    privateArgs,
    label,
  },
  { governedParams, timer, contractGovernor, committeeCreator },
) => {
  const poserInvitationP = E(committeeCreator).getPoserInvitation();
  const [initialPoserInvitation, electorateInvitationAmount] =
    await Promise.all([
      poserInvitationP,
      E(E(zoe).getInvitationIssuer()).getAmountOf(poserInvitationP),
    ]);

  trace('awaiting governorTerms');
  const governorTerms = await deeplyFulfilledObject(
    harden({
      timer,
      governedContractInstallation,
      governed: {
        terms: {
          governedParams: {
            [CONTRACT_ELECTORATE]: {
              type: ParamTypes.INVITATION,
              value: electorateInvitationAmount,
            },
            ...governedParams,
          },
        },
        issuerKeywordRecord,
        label,
      },
    }),
  );

  trace('awaiting startInstance');
  const governorFacets = await E(zoe).startInstance(
    contractGovernor,
    {},
    governorTerms,
    harden({
      economicCommitteeCreatorFacet: committeeCreator,
      governed: {
        ...privateArgs,
        initialPoserInvitation,
      },
    }),
    `${label}-governor`,
  );

  trace('awaiting facets');
  const [instance, publicFacet, creatorFacet, adminFacet] = await Promise.all([
    E(governorFacets.creatorFacet).getInstance(),
    E(governorFacets.creatorFacet).getPublicFacet(),
    E(governorFacets.creatorFacet).getCreatorFacet(),
    E(governorFacets.creatorFacet).getAdminFacet(),
  ]);

  /** @type {GovernanceFacetKit<SF>} */
  const facets = harden({
    instance,
    publicFacet,
    governor: governorFacets.instance,
    creatorFacet,
    adminFacet,
    governorCreatorFacet: governorFacets.creatorFacet,
    governorAdminFacet: governorFacets.adminFacet,
  });
  return facets;
};

/**
 * @param {BootstrapPowers & QstnBootstrapSpace & {
 *   installation: {
 *     consume: {
 *       qstnRouter: Installation<routerStartFn>;
 *       contractGovernor: Installation<import('@agoric/governance/src/contractGovernor.js')['start']>
 *     };
 *   };
 *   instance: {
 *     produce: {
 *       qstnRouter: Producer<Instance<routerStartFn>>
 *     };
 *   };
 *   issuer: {
 *     consume: {
 *       BLD: Issuer<'nat'>;
 *       IST: Issuer<'nat'>;
 *     };
 *   };
 * }} powers
 * @param {{
 *   options: {
 *     chainInfo: Record<string, CosmosChainInfo>;
 *     assetInfo: [Denom, DenomDetail & { brandKey?: string }][];
 *   };
 * }} config
 */
export const startQstnRouter = async (
  {
    zone: rootZone,
    consume: {
      agoricNames,
      board,
      chainStorage,
      chainTimerService,
      cosmosInterchainService,
      qstnCommitteeCreatorFacet,
      localchain,
      zoe,
    },
    produce: { qstnKit: produceQstnKit },
    installation: {
      consume: { qstnRouter: qstnRouterInstallation, contractGovernor },
    },
    instance: {
      produce: { qstnRouter: qstnRouterInstance },
    },
    issuer: {
      consume: { BLD, IST },
    },
  },
  { options: { chainInfo, assetInfo } },
) => {
  trace('startQstnRouter');

  const zone = rootZone.subZone(storagePath);

  const storageNode = await E(chainStorage).makeChildNode('qstnRouter');
  await E(storageNode).setValue('');

  trace('Setting privateArgs');

  const privateArgs = await deeplyFulfilledObject(
    harden({
      agoricNames,
      localchain,
      orchestrationService: cosmosInterchainService,
      storageNode: E(NonNullish(await chainStorage)).makeChildNode(
        instanceName,
      ),
      timerService: chainTimerService,
      chainInfo,
      assetInfo,
      marshaller: E(board).getPublishingMarshaller(),
    }),
  );

  trace('startQstnRouter awaiting startInstance');

  /** @param {() => Promise<Issuer>} p */
  const safeFulfill = async p =>
    E.when(
      p(),
      i => i,
      () => undefined,
    );

  const axlIssuer = await safeFulfill(() =>
    E(agoricNames).lookup('issuer', 'AXL'),
  );

  const atomIssuer = await safeFulfill(() =>
    E(agoricNames).lookup('issuer', 'ATOM'),
  );

  const issuerKeywordRecord = harden({
    BLD: await BLD,
    IST: await IST,
    ...(axlIssuer && { AXL: axlIssuer }),
    ...(atomIssuer && { ATOM: atomIssuer }),
  });
  trace('issuerKeywordRecord', issuerKeywordRecord);

  const facets = await startGovernedInstance(
    {
      zoe,
      governedContractInstallation: qstnRouterInstallation,
      issuerKeywordRecord,
      privateArgs,
      label: instanceName,
    },
    {
      governedParams: {},
      timer: chainTimerService,
      contractGovernor,
      committeeCreator: qstnCommitteeCreatorFacet,
    },
  );

  const qsntKit = harden({
    ...facets,
    label: instanceName,
    privateArgs,
  });
  produceQstnKit.resolve(qsntKit);
  const ck = zone.mapStore('ContractKits');
  ck.init(facets.instance, qsntKit);

  const { instance } = facets;
  qstnRouterInstance.resolve(instance);
  trace('startQstnRouter complete');
};
harden(startQstnRouter);

export const startQstnRouterManifest = (
  { restoreRef },
  { installationRef, options },
) => {
  return {
    manifest: {
      [startQstnRouter.name]: {
        consume: {
          agoricNames: true,
          board: true,
          chainStorage: true,
          chainTimerService: true,
          cosmosInterchainService: true,
          localchain: true,
          zoe: true,
        },
        installation: {
          consume: {
            qstnRouter: true,
          },
        },
        instance: {
          produce: {
            qstnRouter: true,
          },
        },
        issuer: {
          consume: { BLD: true, IST: true, AXL: true, ATOM: true },
        },
      },
      installations: {
        qstnRouter: restoreRef(installationRef),
      },
      options,
    },
  };
};

export const manifest = harden(startQstnRouterManifest);
