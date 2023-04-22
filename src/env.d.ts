/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable no-var */
import type * as ReactDOMClient from "react-dom/client";

declare module "react-dom" {
  var createRoot: typeof ReactDOMClient.createRoot;
  var hydrateRoot: typeof ReactDOMClient.hydrateRoot;
}

declare var React: typeof import("react");
declare var ReactDOM: typeof import("react-dom");

/* eslint-disable no-var */
interface Process {
  env: Record<string, string>;
}

declare const process: Process;

declare var spectating: boolean;

declare interface Math {
  PI2: number;
}

declare interface Number {
  round(to: number): number;
}
