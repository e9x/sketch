/* eslint-disable no-var */

import sketchConfig from "./sketchConfig";
import { iInputs } from "./consts";
import {
  getConfig,
  getGame,
  getLocalPlayer,
  getOverlay,
  getRender,
} from "./filters";
import type { AI } from "./krunker/AI";
import type { Player } from "./krunker/Player";
import * as THREE from "three";

// optimize call (tampermonkey is slow)
const { Math, document } = window;

export function getD3D(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function getXDire(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
) {
  return (
    Math.asin(Math.abs(y1 - y2) / getD3D(x1, y1, z1, x2, y2, z2)) *
    (y1 > y2 ? -1 : 1)
  );
}

export function getDir(x1: number, y1: number, x2: number, y2: number) {
  return Math.atan2(y1 - y2, x1 - x2);
}

export function getAngleDst(a1: number, a2: number) {
  return Math.atan2(Math.sin(a2 - a1), Math.cos(a1 - a2));
}

export function playerPos(player: Player | AI) {
  const game = getGame();

  return new game.THREE.Vector3(player.x, player.y, player.z);
}

export function getOffScreenDir(
  camera: THREE.PerspectiveCamera,
  vector: THREE.Vector3,
) {
  const cameraSpace = vector.clone();
  cameraSpace.applyMatrix4(camera.matrixWorldInverse);
  const projectedVector = vector.clone();
  projectedVector.project(camera);
  if (cameraSpace.z > 0) {
    projectedVector.x *= -1;
    projectedVector.y *= -1;
  }
  return Math.atan2(projectedVector.y, projectedVector.x);
}

export function pos2D(input: THREE.Vector3, offsetY = 0) {
  const render = getRender();
  const overlay = getOverlay();

  const vec = input.clone();
  vec.y += offsetY;
  vec.project(render.camera);
  vec.x = (vec.x + 1) / 2;
  vec.y = (-vec.y + 1) / 2;
  vec.x *= innerWidth / overlay.scale;
  vec.y *= innerHeight / overlay.scale;

  return new render.THREE.Vector2(vec.x, vec.y);
}

export function entityAlive(entity: Player | AI) {
  if (entity.health <= 0) return false;

  if (!entity.active) return false;

  return true;
}

export function isEnemy(entity: Player | AI) {
  const localPlayer = getLocalPlayer();

  if (entity.isPlayer && entity.isYou) return false;

  if (!entity.active) return false;

  if (!entity.team) return true;

  if (entity.team !== localPlayer.team) return true;

  return false;
}

export function getAimTime(inputs: number[]) {
  const localPlayer = getLocalPlayer();
  const minAimTime = 0.1;

  let aimTime =
    Math.max(minAimTime, Math.min(inputs[iInputs.frame], getConfig().dltMx)) /
    localPlayer.deltaDiv;
  if (!aimTime || aimTime < minAimTime) aimTime = minAimTime;

  return aimTime;
}

export function getCurrentReloadTimer(aimTime: number) {
  const localPlayer = getLocalPlayer();
  let reloadTimer = localPlayer.reloadTimer;

  if (reloadTimer > 0) {
    reloadTimer -= aimTime;
    if (reloadTimer <= 0) reloadTimer = 0;
  }

  return reloadTimer;
}

export function getCurrentSwapTime(aimTime: number) {
  const localPlayer = getLocalPlayer();
  let swapTime = localPlayer.swapTime;

  if (swapTime > 0) {
    swapTime -= aimTime;
    if (swapTime < 0) swapTime = 0;
  }

  return swapTime;
}

export function getCurrentReload(aimTime: number) {
  const localPlayer = getLocalPlayer();

  // calculate exactly when we can shoot
  // the players.shoot() logic does this but we need to see the value as if it already did this logic
  // currentReload isn't updated so we update it locally before shoot()

  let currentReload = localPlayer.reloads[localPlayer.loadoutIndex];

  if (currentReload) {
    currentReload -= aimTime;
    if (currentReload < 0) currentReload = 0;
  }

  return currentReload;
}

export function getChargeMlt() {
  const e = getLocalPlayer();
  const game = getGame();

  let mlt = 1;

  if (e.weapon && e.weapon.rateChrg) {
    mlt = 1 - Math.min(1, e.chargeTime / e.weapon.chrgTime!);
    if (game.mode.forceCharge) mlt = 0;

    mlt = Math.max(0.7, 1.5 * mlt);
  }

  return mlt;
}

export function getReload() {
  const e = getLocalPlayer();
  const game = getGame();

  return (
    (e.burstCount && e.weapon.burst ? e.weapon.burstR! : e.weapon.rate!) *
    (game.config.fiRat || 1) *
    e.attributes.fRate *
    (e.perks.includes(1) ? 0.66 : 1) *
    (e.isKranked ? game.mode.bonuses.firerate : 1) *
    getChargeMlt()
  );
}

export function canShoot(aimTime: number) {
  return (
    getCurrentReload(aimTime) <= 0 &&
    getCurrentSwapTime(aimTime) <= 0 &&
    getCurrentReloadTimer(aimTime) <= 0
  );
}

export function isInMenus() {
  if (sketchConfig.get("espMenu")) return false;
  const l = document.getElementById("uiBase");
  return l?.classList.contains("onMenu") || l?.classList.contains("onEndScrn");
}

export function isOnEndScreen() {
  const l = document.getElementById("uiBase");
  return l?.classList.contains("onEndScrn") ?? false;
}

/**
 * will not return an accurate FPS unless showFPS is enabled in game or it's forced to calculate FPS
 */
export function getFPS() {
  return document.getElementById("ingameFPS")?.textContent || "0";
}

export function getPing() {
  return document.getElementById("pingText")?.textContent || "0";
}
/*export function isInGame() {
  return (
    document.getElementById("deathUIHolder")?.style.display !== "none" &&
    !isInMenus()
  );
}*/

export function smoothnessMultiplier(smoothFactor: number) {
  if (smoothFactor <= 0) return 1;
  if (smoothFactor > 1) {
    return 0.01 / smoothFactor;
  }
  return 1 - Math.log10(smoothFactor * 9 + 1) * 0.99;
}

export function lerp(
  rotation: THREE.Vector2,
  from: THREE.Vector2,
  smoothFactor: number,
) {
  const realSmoothFactor = smoothnessMultiplier(smoothFactor);
  rotation.setX(from.x + getAngleDst(from.x, rotation.x) * realSmoothFactor);
  rotation.setY(from.y + getAngleDst(from.y, rotation.y) * realSmoothFactor);
  return rotation;
}

export function getOverlaySizeScaled() {
  const overlay = getOverlay();

  return {
    width: innerWidth / overlay.scale,
    height: innerHeight / overlay.scale,
  };
}

export function isMesh(e: THREE.Object3D): e is THREE.Mesh {
  return e.type === "Mesh";
}

export function getPlayerMeshes(player: Player, weapons = true) {
  const meshes: THREE.Mesh[] = [];

  for (const mesh of player.legMeshes) meshes.push(mesh);
  for (const mesh of player.mergedArmMeshes) meshes.push(mesh);
  if (weapons)
    for (const e of player.weaponMeshes)
      for (const mesh of e.children) meshes.push(mesh);
  if (player.headObj) meshes.push(player.headObj);
  if (player.lowerBody)
    for (const e of player.lowerBody.children)
      if (e.name === "body" && isMesh(e)) meshes.push(e);
  for (const e of player.shoeMeshes)
    for (const mesh of e.children) meshes.push(mesh);
  if (player.bodyMesh)
    for (const mesh of player.bodyMesh.children) meshes.push(mesh);
  if (player.headMesh)
    for (const mesh of player.headMesh.children) meshes.push(mesh);
  if (player.faceMesh)
    for (const mesh of player.faceMesh.children) meshes.push(mesh);
  if (player.backMesh)
    for (const mesh of player.backMesh.children) meshes.push(mesh);

  return meshes;
}

export function get3Ddistance(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
) {
  return Math.sqrt(
    Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2),
  );
}
