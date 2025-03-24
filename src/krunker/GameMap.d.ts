import type MapObject from "./Object";
import type Terrain from "./Terrain";

export interface SpawnPoint {
  comp: boolean;
  dir: number;
  spread: number;
  team: number;
  teamOnly: boolean;
  x: number;
  y: number;
  z: number;
  /**
   * Set by calling getSpawnPoint()
   * SERVER
   */
  dst?: number;
}

export interface MapData {
  skyCol: string;
}

export interface GameMode {
  id: string;
  name: string;
}

declare class GameMap {
  objects: MapObject[];
  terrain: Terrain | null;
  manager: {
    objects: MapObject[];
  };
  maps: MapData[];
  spawns: SpawnPoint[];
}

export default GameMap;
