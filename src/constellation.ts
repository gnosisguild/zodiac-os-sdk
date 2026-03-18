type CodegenData = {
  safes: Record<string, Record<string, any>>;
  users: Record<string, { fullName: string; address: `0x${string}` }>;
};

type ConstellationOpts = {
  workspace: string;
  label: string;
  chain: number;
  codegen: CodegenData;
};

type NodeRef = Readonly<Record<string, any>>;

export function constellation(opts: ConstellationOpts) {
  const nodes: NodeRef[] = [];

  function makeNodeRef(data: Record<string, any>): NodeRef {
    const ref = Object.freeze({ ...data, __chain: opts.chain });
    nodes.push(ref);
    return ref;
  }

  function entityAccessor(
    registry: Record<string, Record<string, any>>,
    type: string,
  ) {
    return new Proxy(
      function create(props: Record<string, any>) {
        return makeNodeRef({ type, ...props });
      },
      {
        get(_target: any, name: string) {
          if (typeof name !== "string") return undefined;
          const existing = registry[name];
          return (overrides?: Record<string, any>) => {
            return makeNodeRef({
              type,
              ...(existing || {}),
              ...overrides,
              label: name,
            });
          };
        },
      },
    );
  }

  function userAccessor() {
    return new Proxy(
      {},
      {
        get(_target: any, name: string) {
          const user = opts.codegen.users[name];
          if (!user) throw new Error(`Unknown user: ${name}`);
          return user.address;
        },
      },
    );
  }

  return {
    safe: entityAccessor(opts.codegen.safes, "SAFE"),
    roles: entityAccessor(opts.codegen.safes, "ROLES"),
    user: userAccessor(),
    _nodes: nodes,
  };
}
