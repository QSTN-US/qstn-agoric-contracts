# QSTN Agoric DApp EVM

A cross-chain survey platform built on Agoric with support for multiple EVM chains (Avalanche, Ethereum, Optimism, Arbitrum, Base) and Cosmos chains (Osmosis, Neutron). The platform enables decentralized survey creation, funding, and reward distribution across multiple blockchain networks using Axelar GMP and IBC.

## Architecture

The repository contains four main contract implementations that work together to enable cross-chain survey functionality:

### Repo Breakdown

```text
qstn-agoric-dapp-evm/
├── contract/          # Agoric orchestration contract (JavaScript)
├── solidity/          # EVM GMP-powered contract (Solidity)
├── wasm/             # CosmWasm contracts (Rust)
│   ├── quizzler-osmosis/
│   └── quizzler-neutron/
└── deploy/           # Deployment scripts
```

### Cross-Chain Message Flow

```text
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
- Routes transactions to EVM chains (via Axelar GMP) and Cosmos chains (via IBC)
- Manages BLD token payments for survey funding

**Main Files**:

- `qstn.contract.js` - Contract initialization and public invitation makers
- `qstn.flows.js` - Orchestration flows for sending transactions
- `qstn-account-kit.js` - Account kit for managing LCAs

**Contract Name**: `qstnRouterV1`

### 2. EVM GMP Contract (QuizzlerGMP)

**Location**: `solidity/contracts/QuizzlerGMP.sol`

A Solidity contract deployable on any EVM chain (Avalanche, Ethereum, Optimism, Arbitrum, Base) that receives cross-chain messages from Agoric via Axelar's General Message Passing (GMP).

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

- `qstn.start.js` - Deploys the QSTN Router contract
- `qstn.build.js` - Contract build configuration
- `qstn.contract.permit.js` - Contract permissions
- `qstn.deploy.type.js` - Deployment type definitions

**Test Configuration**:

- `deploy/test/utils/mock-chain.info.js` - Chain and asset configurations for testing

## How It Works

### Cross-Chain Survey Flow

1. **Survey Creation (Agoric → Target Chain)**:
   - User connects Keplr wallet to Agoric chain
   - User funds survey with BLD tokens via the QSTN Router contract
   - Router orchestrates cross-chain message to target chain (EVM or Cosmos)
   - For EVM chains: Message routed via Axelar GMP
   - For Cosmos chains: Message routed via IBC
   - Target chain contract receives message and creates survey

2. **Reward Distribution (Agoric → Target Chain)**:
   - Survey participants complete surveys off-chain
   - Reward claims are initiated on Agoric
   - Router sends cross-chain message with participant addresses
   - Target chain contract distributes rewards from survey pool

### Supported Chains

#### Cosmos Chains (IBC)

- **Agoric** (agoriclocal/devnet): Router contract, orchestration layer
- **Osmosis** (osmo-test-5): Via IBC transfer channel
- **Neutron** (pion-1): Via IBC transfer channel
- **Axelar**: Via IBC for cross-chain messaging

#### EVM Chains (Axelar GMP)

**Mainnet**:

- **Avalanche** (Chain ID: 43114)
- **Ethereum** (Chain ID: 1)
- **Optimism** (Chain ID: 10)
- **Arbitrum** (Chain ID: 42161)
- **Base** (Chain ID: 8453)

**Testnet**:

- **Avalanche Fuji** (Chain ID: 43113)
- **Ethereum Sepolia** (Chain ID: 11155111)
- **Optimism Sepolia** (Chain ID: 11155420)
- **Arbitrum Sepolia** (Chain ID: 421614)
- **Base Sepolia** (Chain ID: 84532)

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
cd deploy

# First, deploy chain info
yarn deploy:chain-info:devnet

# Then, deploy QSTN Router contract
yarn deploy:contract:devnet
```

### Deploy to Local Network

```bash
cd deploy

# First, deploy chain info
yarn deploy:chain-info:local

# Then, deploy QSTN Router contract
yarn deploy:contract:local
```

## Configuration

### Chain Configuration

Chain and asset configurations are defined in `deploy/test/utils/mock-chain.info.js`. The configuration includes:

- **Cosmos Chains**: Chain IDs, bech32 prefixes, IBC connection details, transfer channels
- **EVM Chains**: Namespace (eip155), chain references (Chain IDs), CCTP destination domains
- Separate configurations for mainnet and testnet EVM chains

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
