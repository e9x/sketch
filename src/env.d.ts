/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable no-var */

declare module "react-dom" {
  var createRoot: typeof import("react-dom/client").createRoot;
  var hydrateRoot: typeof import("react-dom/client").hydrateRoot;
}

declare var ReactDOM: typeof import("react-dom");

/* eslint-disable no-var */
interface Process {
  env: Record<string, string>;
}

declare var spectating: boolean;

declare interface Math {
  PI2: number;
}

declare interface Number {
  round(to: number): number;
}
