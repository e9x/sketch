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
