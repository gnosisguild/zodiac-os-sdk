# Zodiac OS SDK

Programmatically manage [Zodiac](https://www.zodiac.eco) account constellations.

## Getting started

### 1. Install

```bash
npm install @zodiac-os/sdk
```

### 2. Generate a Zodiac OS API key

Sign in to [app.zodiac.eco](https://app.zodiac.eco) and create an API key at [app.zodiac.eco/admin/api-keys](https://app.zodiac.eco/admin/api-keys).

### 3. Create a config file

Create a `zodiac.config.ts` in your project root:

```ts
import { defineConfig } from '@zodiac-os/sdk/cli/config'

export default defineConfig({
  apiKey: 'zodiac_your-api-key',
  // Optional: contract addresses for eth-sdk ABI fetching
  contracts: {
    mainnet: {
      dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    },
  },
})
```

### 4. Pull your org data

```bash
# Pull everything (org data + contract ABIs)
zodiac-os pull
```

This generates typed data in `.zodiac-os/types/index.ts` with your org's users and vaults.

## Constellation API

The `constellation()` function is the main SDK entry point. It takes the codegen output and returns an API for declaring account constellations — the set of Safes, Roles mods, and users that make up your on-chain setup.

```ts
import { constellation } from '@zodiac-os/sdk'
import * as codegen from './.zodiac-os/types'
```

### Scoping to a chain

```ts
const eth = constellation({
  workspace: 'my-org',
  label: 'Production',
  chain: 1,
  codegen,
})
```

### Referencing existing accounts

Bracket access gives you existing Safes and Roles mods from your org. Names auto-complete from the codegen output.

```ts
// Reference an existing Safe (all properties are already known from codegen)
const ggDao = eth.safe['GG DAO']()

// Optionally pass overrides
const ggDaoWithOverrides = eth.safe['GG DAO']({ threshold: 5 })
```

### Referencing existing Roles mods

Bracket access on `eth.roles` with a Safe name gives the canonical Roles mod for that Safe:

```ts
const ggDaoRoles = eth.roles['GG DAO']({
  roles: { eth_wrapping },
})
```

### Creating new accounts

Call `eth.safe(...)` or `eth.roles(...)` directly to create new nodes:

```ts
// New Safe — all required fields must be provided
const newSafe = eth.safe({
  label: 'New Safe',
  nonce: 0n,
  threshold: 2,
  owners: [
    eth.user['Alice Sample'],
    '0xb8e48df6818d3cbc648b3e8ec248a4f547135f7a',
  ],
  modules: [ggDaoRoles],
})

// New Roles mod targeting an existing Safe
const newRoles = eth.roles({
  nonce: 123n,
  target: ggDao,
})
```

### Referencing users

`eth.user[handle]` resolves a user to their personal Safe address on the current chain:

```ts
const aliceAddress = eth.user['Alice Sample']
```

### Exporting the constellation

Only explicitly exported nodes are included — there are no registration side-effects:

```ts
export { ggDao, ggDaoRoles, newSafe, newRoles }
```

## CLI reference

```
Usage: zodiac-os [options] [command]

Zodiac OS SDK CLI – pull org data and contract ABIs

Options:
  -V, --version        output the version number
  -c, --config <path>  path to the config file (default: "zodiac.config.ts")
  -h, --help           display help for command

Commands:
  pull-org             Fetch Zodiac users and vaults, generate TypeScript types
  pull-contracts       Fetch contract ABIs, generate typed permissions kit
  pull                 Fetch Zodiac org and contracts ABI, generate SDK functions
  help [command]       display help for command
```
