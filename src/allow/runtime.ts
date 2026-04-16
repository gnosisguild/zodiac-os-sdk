import {
  Interface,
  FunctionFragment,
  isError,
  type InterfaceAbi,
} from "ethers";
import { c, coercePermission } from "zodiac-roles-sdk";
import type {
  Condition,
  FunctionPermission,
  TargetPermission,
} from "zodiac-roles-sdk";
import { ParameterType, Operator } from "zodiac-roles-deployments";
import { readAbi, walkContracts, type ContractNode } from "./abi";
import { EVERYTHING, type Options } from "./types";

export function buildAllowKit(
  abisDir: string,
  contractsConfig: Record<string, any>,
): Record<string, any> {
  const kit: Record<string, any> = {};
  for (const node of walkContracts(contractsConfig)) {
    const abi = readAbi(abisDir, node);
    if (!abi) {
      // Defer the error until the user touches this contract — otherwise an
      // ABI missing for one chain crashes all unrelated role definitions.
      attachAt(kit, [node.chain, ...node.segments], missingAbiProxy(node));
      continue;
    }
    attachAt(
      kit,
      [node.chain, ...node.segments],
      makeAllowContract(node.address, abi as InterfaceAbi),
    );
  }
  return kit;
}

function attachAt(root: Record<string, any>, segments: string[], value: any) {
  let cursor = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    if (!(seg in cursor)) cursor[seg] = {};
    cursor = cursor[seg];
  }
  cursor[segments[segments.length - 1]!] = value;
}

function missingAbiProxy(node: ContractNode) {
  const explain = () => {
    throw new Error(
      `ABI missing for ${node.chain}.${node.segments.join(".")} ` +
        `(${node.address}). Run \`zodiac-os pull-contracts\` to fetch it, or ` +
        `paste the ABI JSON manually at <abisDir>/${node.chain}/${node.segments.join("/")}.json`,
    );
  };
  return new Proxy(
    {},
    {
      get: explain,
      has: explain,
    },
  );
}

function makeAllowContract(
  address: `0x${string}`,
  abi: InterfaceAbi,
): Record<string | symbol, any> {
  const iface = Interface.from(abi);
  const lowerAddr = address.toLowerCase() as `0x${string}`;

  const allowEverything = (options?: Options): TargetPermission => ({
    targetAddress: lowerAddr,
    send: options?.send,
    delegatecall: options?.delegatecall,
  });

  const has = (name: string) => {
    try {
      const fn = iface.getFunction(name);
      if (!fn) return false;
      return fn.stateMutability !== "view" && fn.stateMutability !== "pure";
    } catch (error) {
      if (!isError(error as any, "INVALID_ARGUMENT")) throw error;
      return false;
    }
  };

  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === EVERYTHING) return allowEverything;
        if (typeof prop !== "string") return undefined;
        if (!has(prop)) return undefined;
        const fn = iface.getFunction(prop)!;
        return makeAllowFunction(fn, lowerAddr);
      },
      has: (_target, prop) => {
        if (prop === EVERYTHING) return true;
        return typeof prop === "string" && has(prop);
      },
    },
  );
}

function makeAllowFunction(
  fn: FunctionFragment,
  targetAddress: `0x${string}`,
): (...args: any[]) => FunctionPermission {
  const inputs = fn.inputs;
  return (...args: any[]) => {
    const scopings = args.slice(0, inputs.length);
    const hasScopings = scopings.some((s) => s !== undefined && s !== null);
    const options: Options = args[inputs.length] ?? {};
    const condition = hasScopings
      ? c.calldataMatches(scopings, inputs)()
      : undefined;
    const preset = {
      targetAddress,
      signature: fn.format("sighash"),
      condition,
    };
    return applyOptions(coercePermission(preset as any) as any, options);
  };
}

const emptyCalldataMatches: Condition = {
  paramType: ParameterType.Calldata,
  operator: Operator.Matches,
  children: [],
};

const applyGlobalAllowance = (
  condition: Condition | undefined,
  allowanceCondition: Condition,
): Condition => {
  const base = condition ?? emptyCalldataMatches;
  if (
    base.paramType !== ParameterType.Calldata ||
    base.operator !== Operator.Matches
  ) {
    throw new Error(
      "Global allowance can only be applied to calldata matches nodes",
    );
  }
  return {
    ...base,
    children: [...(base.children ?? []), allowanceCondition],
  };
};

const applyOptions = (
  permission: FunctionPermission & { condition?: Condition },
  options: Options,
): FunctionPermission => {
  let condition = permission.condition;
  if (options.etherWithinAllowance) {
    if (!options.send) {
      throw new Error(
        "`etherWithinAllowance` can only be used if `send` is allowed",
      );
    }
    condition = applyGlobalAllowance(condition, {
      paramType: ParameterType.None,
      operator: Operator.EtherWithinAllowance,
      compValue: options.etherWithinAllowance,
    });
  }
  if (options.callWithinAllowance) {
    condition = applyGlobalAllowance(condition, {
      paramType: ParameterType.None,
      operator: Operator.CallWithinAllowance,
      compValue: options.callWithinAllowance,
    });
  }
  return {
    ...permission,
    send: options.send,
    delegatecall: options.delegatecall,
    condition,
  };
};
