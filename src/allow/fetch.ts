import { chainIdFor, type ChainPrefix } from "./networks";

export type AbiFragment = Record<string, any>;
export type Abi = AbiFragment[];

// Returns null on any failure so callers can fall back to a manual ABI file.
export async function fetchAbi(
  chainId: number,
  address: `0x${string}`,
): Promise<Abi | null> {
  const url = `https://api.abi.pub/v1/chains/${chainId}/etherscan?module=contract&action=getabi&address=${address}`;
  let body: { status?: string; message?: string; result?: string };
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    body = (await resp.json()) as typeof body;
  } catch {
    return null;
  }
  if (body.status !== "1" || typeof body.result !== "string") return null;
  try {
    const parsed = JSON.parse(body.result);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as Abi;
  } catch {
    return null;
  }
}

export const fetchAbiForPrefix = (
  prefix: ChainPrefix,
  address: `0x${string}`,
) => fetchAbi(chainIdFor(prefix), address);
