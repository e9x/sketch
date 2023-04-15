import type { Player, manager } from "./Player";
import type THREE from "three";

declare class Game {
  constructor(...args: unknown[]);
  AI: {
    ais: unknown[];
  };
  COLLISIONS: unknown;
  THREE: typeof THREE;
  players: manager;
  config: unknown;
  raycaster: THREE.Raycaster;
  controls: {
    spect: unknown;
    tmpInpts: number[][];
    object: THREE.Object3D;
    pchObjc: THREE.Object3D;
    xDr: number;
    yDr: number;
  };
  ui: {
    loading: boolean;
  };
  roundId: string;
  sessionId: string;
  store: unknown;
  get isServer(): boolean;
  get tmpPlayer(): Player | null;
}

export default Game;
