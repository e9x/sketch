import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import {
  getCanBSeen,
  getConfig,
  getGame,
  getLocalPlayer,
  getRender,
  inputHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import { getDir, getXDire, playerPos } from "../krunkerUtil";
import Switch from "../menu/components/Switch";
import type THREE from "three";

const defaultAimbot = false;

function antiRecoil(rot: THREE.Vector2) {
  rot.x -= getRender().shakeY;
  rot.x -= getLocalPlayer().recoilAnimY * getConfig().recoilMlt;
  rot.x -= getLocalPlayer().landBobY * 0.1;
}

function calcRot(target: Player) {
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
      target.y + target.height - target.crouchVal * getConfig().crouchAnimMlt,
      target.z
    ) || 0;
  const yDire = getDir(localPlayer.z, localPlayer.x, target.z, target.x) || 0;

  return new render.THREE.Vector2(xDire, yDire);
}

function validTarget(target: Player) {
  const localPlayer = getLocalPlayer();

  if (target === localPlayer) return false;

  if (!target[getCanBSeen()]) return false;

  if (!isEnemy(target)) return false;

  if (!getRender().frustum.containPoint(playerPos(target))) return false;

  return true;
}

function isEnemy(player: Player) {
  const localPlayer = getLocalPlayer();

  if (!localPlayer) return false;

  if (player.isYou) return false;

  if (!player.active) return false;

  if (!player.team) return true;

  if (player.team !== localPlayer.team) return true;

  return false;
}

export function aimbotHook() {
  let target: Player | undefined;

  inputHooks.push((inputs) => {
    if (!configGet("aimbot", defaultAimbot)) return;

    const game = getGame();

    if (!inputs[iInputs.scope]) return;

    if (!target || !validTarget(target))
      target = game.players.list.find(validTarget);

    if (target) {
      // console.log("target:", target);

      const rot = calcRot(target);

      antiRecoil(rot);

      game.controls.pchObjc.rotation.x = rot.x;
      game.controls.object.rotation.y = rot.y;
      // game.controls.xDr = game.controls.object.rotation.y % Math.PI2;
      // game.controls.yDr = game.controls.pchObjc.rotation.x % Math.PI2;

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
