/* eslint-disable no-var */

import { iInputs } from "./consts";
import {
  getConfig,
  getGame,
  getLocalPlayer,
  getOverlay,
  getRender,
} from "./filters";
import type { Player } from "./krunker/Player";
import type THREE from "three";

export function getDistance(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
}

export function getD3D(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
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
  z2: number
) {
  return (
    Math.asin(Math.abs(y1 - y2) / getD3D(x1, y1, z1, x2, y2, z2)) *
    (y1 > y2 ? -1 : 1)
  );
}

export function getDir(x1: number, y1: number, x2: number, y2: number) {
  return Math.atan2(y1 - y2, x1 - x2);
}

export function lineInRect(
  lx1: number,
  lz1: number,
  ly1: number,
  dx: number,
  dz: number,
  dy: number,
  x1: number,
  z1: number,
  y1: number,
  x2: number,
  z2: number,
  y2: number
) {
  const t1 = (x1 - lx1) * dx;
  const t2 = (x2 - lx1) * dx;
  const t3 = (y1 - ly1) * dy;
  const t4 = (y2 - ly1) * dy;
  const t5 = (z1 - lz1) * dz;
  const t6 = (z2 - lz1) * dz;

  const tmin = Math.max(
    Math.max(Math.min(t1, t2), Math.min(t3, t4)),
    Math.min(t5, t6)
  );

  const tmax = Math.min(
    Math.min(Math.max(t1, t2), Math.max(t3, t4)),
    Math.max(t5, t6)
  );

  return tmax < 0 || tmin > tmax ? false : tmin;
}

export function getAngleDst(a1: number, a2: number) {
  return Math.atan2(Math.sin(a2 - a1), Math.cos(a1 - a2));
}

export function playerPos(player: Player) {
  const game = getGame();

  return new game.THREE.Vector3(player.x, player.y, player.z);
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

export function isEnemy(player: Player) {
  const localPlayer = getLocalPlayer();

  if (player.isYou) return false;

  if (!player.active) return false;

  if (!player.team) return true;

  if (player.team !== localPlayer.team) return true;

  return false;
}

export function progressOnLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
) {
  let ux = x2 - x1;
  let uy = y2 - y1;
  const u2 = Math.sqrt(ux * ux + uy * uy);
  ux /= u2;
  uy /= u2;
  return (
    (ux * (x3 - x1) + uy * (y3 - y1)) /
    Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
  );
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

export function isInMenus() {
  return (
    document.getElementById("endUI")?.style.display !== "none" ||
    document.getElementById("menuHolder")?.style.display !== "none"
  );
}

/*export function isInGame() {
  return (
    document.getElementById("deathUIHolder")?.style.display !== "none" &&
    !isInMenus()
  );
}*/

export function smoothnessMultiplier(smoothFactor: number) {
  if (smoothFactor < 0 || smoothFactor > 1) {
    throw new Error("Smooth factor must be between 0.0 and 1.0");
  }
  return 1 - 0.99 * smoothFactor;
}

export function lerp(
  rotation: THREE.Vector2,
  from: THREE.Vector2,
  smoothFactor: number
) {
  const realSmoothFactor = smoothnessMultiplier(smoothFactor);
  rotation.setX(from.x + getAngleDst(from.x, rotation.x) * realSmoothFactor);
  rotation.setY(from.y + getAngleDst(from.y, rotation.y) * realSmoothFactor);
  return rotation;
}
