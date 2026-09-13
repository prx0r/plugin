import { discoverFunctions } from "../src/discovery.js";

Deno.test("discovery finds own functions without native or getter noise", () => {
  let getterRead = false;
  const mockWindow = {
    myFunc() {
      return 1;
    },
    parseInt,
    Array,
    document: { querySelector() {} },
  };
  Object.defineProperty(mockWindow, "dangerousGetter", {
    enumerable: true,
    get() {
      getterRead = true;
      throw new Error("must not run");
    },
  });

  const discovered = discoverFunctions(mockWindow);
  const names = discovered.map(({ toolName }) => toolName);

  if (!names.includes("myFunc")) throw new Error("Missing developer function");
  if (names.includes("parseInt") || names.includes("Array")) {
    throw new Error("Included native function");
  }
  if (names.some((name) => name.startsWith("document_"))) {
    throw new Error("Included DOM namespace");
  }
  if (getterRead) throw new Error("Invoked a getter during discovery");
});

Deno.test("discovery traverses only requested plain namespaces", () => {
  const mockWindow = {
    app: {
      calculate(a, b) {
        return this.offset + a + b;
      },
      offset: 1,
      deep: { ignored() {} },
    },
    accidental: { noisy() {} },
  };

  const discovered = discoverFunctions(mockWindow, {
    namespaces: ["app"],
    maxDepth: 0,
  });
  const names = discovered.map(({ toolName }) => toolName);
  const calculate = discovered.find(({ toolName }) =>
    toolName === "app_calculate"
  );

  if (!calculate) throw new Error("Missing requested namespace function");
  if (names.includes("app_deep_ignored")) {
    throw new Error("Exceeded namespace depth");
  }
  if (names.includes("accidental_noisy")) {
    throw new Error("Traversed an unrequested namespace");
  }
  if (calculate.fn.apply(calculate.parent, [2, 3]) !== 6) {
    throw new Error("Wrong method receiver");
  }
});

Deno.test("discovery prevents namespace cycles", () => {
  const app = {
    ping() {
      return "pong";
    },
  };
  app.self = app;
  const discovered = discoverFunctions({ app }, {
    namespaces: ["app"],
    maxDepth: 4,
  });
  if (discovered.map(({ toolName }) => toolName).join(",") !== "app_ping") {
    throw new Error("Cycle produced duplicate discoveries");
  }
});
