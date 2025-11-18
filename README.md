# QSTN Agoric DApp EVM

A cross-chain survey platform built on Agoric with support for Avalanche, Osmosis, and Neutron. The platform enables decentralized survey creation, funding, and reward distribution across multiple blockchain networks using Axelar GMP and IBC.

## Architecture

The repository contains four main contract implementations that work together to enable cross-chain survey functionality:

### Repo Breakdown

```
qstn-agoric-dapp-evm/
├── contract/          # Agoric orchestration contract (JavaScript)
├── solidity/          # Avalanche GMP-powered contract (Solidity)
├── wasm/             # CosmWasm contracts (Rust)
│   ├── quizzler-osmosis/
│   └── quizzler-neutron/
└── deploy/           # Deployment scripts
```

### Cross-Chain Message Flow

```
┌─────────┐         ┌──────────────┐         ┌─────────────┐
│  User   │─────────▶│ Agoric Chain │─────────▶│ Target Chain│
│ (Keplr) │         │ QSTN Router  │         │  Quizzler   │
└─────────┘         └──────────────┘         └─────────────┘
                           │                         │
                           │                         │
                    Orchestration API           Survey State
                                             Reward Distribution
```

### 1. Agoric Contract (QSTN Router)

**Location**: `contract/src/`

The Agoric orchestration contract acts as the central router for cross-chain operations. It handles survey funding and reward distribution using Agoric's orchestration API.

**Key Features**:

- Orchestrates cross-chain transactions via Agoric's chain abstraction
- Handles ICA (Interchain Accounts) operations
- Routes transactions to target chains (Avalanche, Osmosis, Neutron)
- Manages BLD token payments for survey funding

**Main Files**:

- `qstn.router.js` - Contract initialization and public invitation makers
- `qstn.flows.js` - Orchestration flows for sending transactions

**Contract Name**: `qstnRouterV1`

### 2. Avalanche GMP Contract (QuizzlerGMP)

**Location**: `solidity/contracts/QuizzlerGMP.sol`

A Solidity contract deployed on Avalanche that receives cross-chain messages from Agoric via Axelar's General Message Passing (GMP).

**Key Features**:

- Receives cross-chain survey creation messages from Agoric
- Manages survey state (participants limit, rewards, status)
- Distributes rewards to survey participants
- Integrates with Axelar GMP for cross-chain messaging
- Supports ERC20 token rewards

**Main Operations**:

- `CREATE_SURVEY_MSG_ID (0)` - Create a new survey
- `CANCEL_SURVEY_MSG_ID (1)` - Cancel an existing survey
- `PAY_REWARDS_MSG_ID (2)` - Distribute rewards to participants

**Dependencies**:

- OpenZeppelin (Upgradeable, Ownable, ReentrancyGuard)
- Axelar GMP SDK

### 3. CosmWasm Contracts (Quizzler)

**Location**: `wasm/contracts/`

Two CosmWasm contracts for Osmosis and Neutron that receive IBC messages from Agoric to manage surveys.

#### Quizzler Osmosis

**Location**: `wasm/contracts/quizzler-osmosis/`

CosmWasm contract deployed on Osmosis for native Cosmos ecosystem integration.

**Key Features**:

- IBC packet handling for cross-chain communication
- Survey lifecycle management (create, fund, cancel)
- Participant reward distribution in native tokens
- IBC acknowledgment handling

#### Quizzler Neutron

**Location**: `wasm/contracts/quizzler-neutron/`

CosmWasm contract deployed on Neutron with similar functionality to the Osmosis version.

**Common Structure**:

- `state.rs` - Contract state management
- `msg.rs` - Message definitions
- `error.rs` - Error handling
- `ibc_lifecycle.rs` - IBC packet lifecycle
- `helpers.rs` - Utility functions

### 4. Deployment Scripts

**Location**: `deploy/src/`

Scripts for deploying and configuring the Agoric router contract.

**Main Files**:

- `start-contract.js` - Deploys the QSTN Router contract
- `init-contract.js` - Initializes contract with chain configurations
- `config.js` - Configuration constants
- `get-chain-config.js` - Chain-specific configuration retrieval
- `static-config.js` - Static chain and asset configurations

## How It Works

### Cross-Chain Survey Flow

1. **Survey Creation (Agoric → Target Chain)**:
   - User connects Keplr wallet to Agoric chain
   - User funds survey with BLD tokens via the QSTN Router contract
   - Router orchestrates cross-chain message to target chain (Avalanche/Osmosis/Neutron)
   - Target chain contract receives message and creates survey

2. **Reward Distribution (Agoric → Target Chain)**:
   - Survey participants complete surveys off-chain
   - Reward claims are initiated on Agoric
   - Router sends cross-chain message with participant addresses
   - Target chain contract distributes rewards from survey pool

### Supported Chains

- **Agoric** (agoricdev-25): Router contract, orchestration layer
- **Avalanche**: Via Axelar GMP bridge
- **Osmosis**: Via IBC
- **Neutron**: Via IBC

## Installation

### Prerequisites

- Node.js 18+
- Yarn 1.22+
- Rust and Cargo (for CosmWasm contracts)
- Solidity compiler (for Avalanche contracts)

### Setup

```bash
# Install dependencies
yarn

# Build all contracts
yarn build
```

### Build Individual Components

```bash
# Build Solidity contracts
yarn build:solidity

# Build deployment scripts
yarn build:deploy
```

## Deployment

### Deploy to Agoric DevNet

```bash
# Deploy QSTN Router contract
yarn deploy:qstnRouter

# Or deploy all contracts
yarn deploy:contracts
```

## Configuration

### Chain Configuration

Chain and asset configurations are defined in `deploy/src/static-config.js`. The configuration includes:

- Chain IDs
- RPC endpoints
- IBC connection details
- Asset denoms and brands

### Environment Variables

Required environment variables for deployment:

```bash
AGORIC_NET=devnet
AGORIC_RPC=https://devnet.rpc.agoric.net:443
```

## Contract Addresses

After deployment, contract addresses are published to Agoric chain storage:

- Router instance: `published.agoricNames.instance.qstnRouterV1`
- Brand information: `published.agoricNames.brand`

## API

### QSTN Router Contract

**Public Invitation Maker**: `makeSendTransactionInvitation`

Creates an invitation to send a cross-chain transaction.

**Parameters**:

- `messages` - Array of Cosmos SDK messages to execute on target chain
- `Payment` - BLD tokens for transaction fees and gas

### Technology Stack

- **Agoric**: Orchestration, Zoe, Orchestration API, ICA
- **Avalanche**: Axelar GMP, ERC20, Solidity
- **Cosmos**: CosmWasm, IBC, CW20
- **Tools**: Yarn Workspaces, Prettier, TypeScript

## Security

- All contracts use reentrancy guards
- Upgradeable contract patterns for Avalanche deployment
- Proof token verification to prevent reward double-claiming
- IBC acknowledgment handling for reliable cross-chain messaging

## License

ISC

## Resources

- [Agoric Documentation](https://docs.agoric.com/)
- [Axelar GMP Documentation](https://docs.axelar.dev/)
- [CosmWasm Documentation](https://docs.cosmwasm.com/)
- [Agoric Orchestration](https://docs.agoric.com/guides/orchestration/)
