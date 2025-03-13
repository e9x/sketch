/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable no-var */

/// <reference types="krunker-ui/window" />

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

declare function getSavedVal(key: string): string | null;
