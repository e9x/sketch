import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import {
  getCanBSeen,
  getConfig,
  getGame,
  getLocalPlayer,
  getOverlay,
  getRender,
  inputHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import { isEnemy, pos2D, getXDire, getDir } from "../krunkerUtil";
import Switch from "../menu/components/Switch";
import type THREE from "three";

/**
 * Get the position that will be aimed at (eg the head)
 */
function playerAimPoint(player: Player) {
  return new (getGame().THREE.Vector3)(
    player.x,
    player.y +
      player.adjustedHeight -
      (getConfig().headScale * player.headMlt) / 2,
    player.z
  );
}

function calcRot(target: THREE.Vector3) {
  const localPlayer = getLocalPlayer();

  const render = getRender();

  const worldPos = new render.THREE.Vector3();

  render.fpsCamera.getWorldPosition(worldPos);

  const xDire =
    getXDire(
      worldPos.x,
      worldPos.y,
      worldPos.z,
      target.x,
      target.y,
      target.z
    ) || 0;
  const yDire = getDir(localPlayer.z, localPlayer.x, target.z, target.x) || 0;

  return new render.THREE.Vector2(xDire, yDire);
}

const defaultAimbot = false;

function antiRecoil(rot: THREE.Vector2) {
  rot.x -= getRender().shakeY;
  rot.x -= getLocalPlayer().recoilAnimY * getConfig().recoilMlt;
  rot.x -= getLocalPlayer().landBobY * 0.1;
}

function validTarget(target: Player) {
  const localPlayer = getLocalPlayer();

  if (target === localPlayer) return false;

  if (!target[getCanBSeen()]) return false;

  if (!isEnemy(target)) return false;

  return true;
}

export function aimbotHook() {
  // let target: Player | undefined;

  inputHooks.push((inputs) => {
    if (!configGet("aimbot", defaultAimbot)) return;

    const game = getGame();
    const overlay = getOverlay();
    const localPlayer = getLocalPlayer();

    // calculate exactly when we can shoot
    // the players.shoot() logic does this but we need to see the value as if it already did this logic
    // currentReload isn't updated so we update it locally before shoot()

    let currentReload = localPlayer.reloads[localPlayer.loadoutIndex];

    if (currentReload) {
      currentReload -= localPlayer.aimTime;
      if (currentReload < 0) currentReload = 0;
    }

    // if (inputs[iInputs.frame] % 10 === 0) console.log(currentReload);

    // if the weapon can't shoot
    // maybe use cantShootTimer?
    if (!inputs[iInputs.shoot] || currentReload || localPlayer.reloadTimer)
      return;

    const overlayCenter = new game.THREE.Vector2(
      overlay.canvas.width / 2,
      overlay.canvas.height / 2
    );

    const target = game.players.list
      .filter(validTarget)
      .map((player) => playerAimPoint(player))
      .filter((point) => getRender().frustum.containPoint(point))
      .map((point) => ({ screen: pos2D(point), point }))
      .sort(
        (p1, p2) =>
          p1.screen.distanceTo(overlayCenter) -
          p2.screen.distanceTo(overlayCenter)
      )[0]?.point;

    if (target) {
      // console.log("target:", target);

      const rot = calcRot(target);

      antiRecoil(rot);

      // game.controls.pchObjc.rotation.x = rot.x;
      // game.controls.object.rotation.y = rot.y;
      // game.controls.xDr = game.controls.object.rotation.y % Math.PI2;
      // game.controls.yDr = game.controls.pchObjc.rotation.x % Math.PI2;

      // prevent moving in weird direction
      inputs[iInputs.moveDir] = -1;

      inputs[iInputs.xDir] = rot.x * 1000;
      inputs[iInputs.yDir] = rot.y * 1000;
    }
  });
}

export function AimbotMenu() {
  const [aimbot, setAimbot] = useConfig("aimbot", defaultAimbot);

  return (
    <Switch
      title="Aimbot"
      defaultChecked={aimbot}
      onChange={(event) => setAimbot(event.currentTarget.checked)}
    />
  );
}
