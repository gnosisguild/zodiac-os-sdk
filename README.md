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
  apiKey: 'zodiac_...',
  // Optional: contracts to fetch for permissions authoring
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

This generates typed data in `node_modules/.zodiac-os/` with your org's users and vaults.

## Constellation API

The `constellation()` function is the main SDK entry point. It returns an API for declaring account constellations — the set of Safes, Roles mods, and users that make up your on-chain setup.

```ts
import { constellation } from '@zodiac-os/sdk'
```

### Scoping to a workspace and chain

Each constellation is scoped to a single workspace and chain. The `workspace` option must be a valid workspace name from your org.

```ts
const eth = constellation({
  workspace: 'GG',
  label: 'Production',
  chain: 1,
})
```

### Referencing existing vaults

Bracket access gives you existing Safes and Roles mods from the selected workspace. Names auto-complete from the codegen output.

```ts
// Reference an existing Safe — no invocation needed
const ggDao = eth.safe['GG DAO']

// Reference the canonical Roles mod for that Safe
const ggDaoRoles = eth.roles['GG DAO']

// Optionally invoke with overrides
const ggDaoOverridden = eth.safe['GG DAO']({ threshold: 5 })
```

### Creating new accounts

Use bracket access with a new label to create new nodes. Required fields are enforced by the type system:

```ts
// New Safe — threshold, owners are required
const newSafe = eth.safe['New Safe']({
  nonce: 0n,
  threshold: 2,
  owners: [
    eth.user['Alice Sample'],
    '0xb8e48df6818d3cbc648b3e8ec248a4f547135f7a',
  ],
  modules: [ggDaoRoles],
})

// New Roles mod targeting an existing Safe
const newRoles = eth.roles['New Roles']({
  nonce: 0n,
  target: ggDao,
})
```

### Referencing users

`eth.user[handle]` resolves a user to their personal Safe address on the current chain:

```ts
const aliceAddress = eth.user['Alice Sample']
```

### Applying the constellation

The `apply()` function takes all nodes and sends them to the Zodiac OS API. Pass either a named object (keys become refs) or an array:

```ts
import { apply } from '@zodiac-os/sdk'

await apply({ ggDao, ggDaoRoles, newSafe, newRoles })
```

All referenced nodes must be included in the `apply()` call.

By default, `apply()` creates an API client from the `ZODIAC_OS_API_KEY` environment variable. You can pass a custom client:

```ts
await apply({ ggDao, newRoles }, { api: new ApiClient({ apiKey: '...' }) })
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
