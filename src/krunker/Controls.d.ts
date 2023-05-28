import type { AI } from "./AI";
import type { Player } from "./Player";

declare class Controls {
  isn: number;
  getISN(): number;
  keys: Record<string, 0 | 1>;
  binds: unknown;
  spect: { target?: Player | AI };
  tmpInpts: number[][];
  object: THREE.Object3D;
  pchObjc: THREE.Object3D;
  xDr: number;
  yDr: number;
}

export default Controls;
