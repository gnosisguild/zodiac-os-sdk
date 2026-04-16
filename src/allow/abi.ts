import fs from "node:fs";
import path from "node:path";
import type { Abi } from "./fetch";

export type ContractAddress = `0x${string}`;

export type ContractNode = {
  chain: string;
  segments: string[];
  address: ContractAddress;
};

export function* walkContracts(
  config: Record<string, any>,
): Generator<ContractNode> {
  for (const [chain, contracts] of Object.entries(config)) {
    yield* walkLevel(chain, [], contracts);
  }
}

function* walkLevel(
  chain: string,
  segments: string[],
  node: unknown,
): Generator<ContractNode> {
  if (typeof node === "string") {
    if (segments.length === 0) {
      throw new Error(`Contract at ${chain} is missing a name`);
    }
    if (!node.startsWith("0x")) {
      throw new Error(
        `Invalid address for ${chain}.${segments.join(".")}: ${node}`,
      );
    }
    yield { chain, segments, address: node as ContractAddress };
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, any>)) {
      yield* walkLevel(chain, [...segments, key], value);
    }
    return;
  }
  throw new Error(
    `Invalid contracts entry at ${chain}.${segments.join(".")}: ${JSON.stringify(node)}`,
  );
}

export const abiFilePath = (abisDir: string, node: ContractNode): string =>
  path.join(abisDir, node.chain, ...node.segments) + ".json";

export const readAbi = (abisDir: string, node: ContractNode): Abi | null => {
  const file = abiFilePath(abisDir, node);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`ABI at ${file} is not a JSON array`);
  }
  return parsed as Abi;
};

export const writeAbi = (
  abisDir: string,
  node: ContractNode,
  abi: Abi,
): void => {
  const file = abiFilePath(abisDir, node);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(abi, null, 2) + "\n", "utf8");
};
