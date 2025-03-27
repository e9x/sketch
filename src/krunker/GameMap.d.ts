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
  skyDome?: boolean;
  skyDomeCol0?: string;
  skyDomeCol1?: string;
  skyDomeCol2?: string;
  skyDomeEmis?: string;
  skyDomeEmisTex?: string;
  skyDomeTex?: boolean;
  skyDomeTexA?: number;
  skyDomeMovD?: string;
  skyDomeMovT?: number;
  ambient?: string;
  light?: string;
  sky?: string;
  fog?: string;
  fogD?: number;
  [key: string]: any;
}

export interface GameMode {
  id: string;
  name: string;
}

declare class GameMap {
  terrain: Terrain | null;
  manager: {
    objects: MapObject[];
  };
  maps: MapData[];
  spawns: SpawnPoint[];
}

export default GameMap;
