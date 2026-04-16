export const CHAIN_IDS = {
  eth: 1,
  oeth: 10,
  gno: 100,
  sep: 11155111,
  matic: 137,
  zkevm: 1101,
  arb1: 42161,
  avax: 43114,
  base: 8453,
  basesep: 84532,
  bnb: 56,
  celo: 42220,
  sonic: 146,
  berachain: 80094,
  unichain: 130,
  worldchain: 480,
  bob: 60808,
  mantle: 5000,
  hemi: 43111,
  katana: 747474,
  linea: 59144,
  ink: 57073,
  hyperevm: 999,
  flare: 14,
  scroll: 534352,
  plasma: 9745,
  megaeth: 4326,
} as const satisfies Record<string, number>;

export type ChainPrefix = keyof typeof CHAIN_IDS;

export const chainIdFor = (prefix: string): number => {
  const id = (CHAIN_IDS as Record<string, number>)[prefix];
  if (id === undefined) {
    throw new Error(`Unknown chain prefix: ${prefix}`);
  }
  return id;
};
