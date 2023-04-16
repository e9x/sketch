/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as THREE from "three";

declare class Terrain extends THREE.Object3D {
  // @ts-ignore
  raycast(
    oX: number,
    oY: number,
    oZ: number,
    dX: number,
    dY: number,
    dZ: number,
    calcNormal?: boolean
  ): THREE.Vector3 | undefined;
}

export default Terrain;
