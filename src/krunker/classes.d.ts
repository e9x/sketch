import type Game from "./Game";
import type { Player } from "./Player";

declare function checkClassAvailability(player: Player, game?: Game): boolean;

interface BaseClass {
  name: string;
  loadout: number[];
  secondary: boolean;
  colors: number[];
  health: number;
  segs: number;
  throwChrg: number;
  speed: number;
  trnSpd: number;
  regen: number;
  wallJ: boolean;
  wallJM: number;
  leap: boolean;
  bkSlid: boolean;
  slT: number;
  slA: number;
  melRate: number;
  face?: number;
  minRec?: number;
  req?: typeof checkClassAvailability;
  txts?: string[];
  hide?: boolean;
  noMobile?: boolean;
  noSleeve?: boolean;
}

declare const classes: BaseClass[];
export default classes;
