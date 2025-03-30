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

export interface MeshData {
  src: string;
  [key: string]: any;
}

export interface MapData {
  name?: string;
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
  ambient?: string | number;
  light?: string | number;
  sky?: string | number;
  fog?: string | number;
  fogD?: number;
  ambInd?: number;
  ambIndC?: number;
  [key: string]: any;
}

export interface GameMode {
  id: string;
  name: string;
  noHPbars?: boolean;
  fakeNames?: boolean;
  ambInd?: number;
  bonuses: {
    firerate: 0;
  };
  forceCharge: boolean;
}

export declare class MapManager {
  objects: MapObject[];
}

declare class GameMap {
  terrain: Terrain | null;
  manager: MapManager;
  maps: MapData[];
  spawns: SpawnPoint[];
}

export default GameMap;
