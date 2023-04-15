import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import {
  getConfig,
  getGame,
  getLocalPlayer,
  getRender,
  inputHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import { validTarget, calcRot } from "../krunkerUtil";
import Switch from "../menu/components/Switch";
import type THREE from "three";

const defaultAimbot = false;

function antiRecoil(rot: THREE.Vector2) {
  rot.x -= getRender().shakeY;
  rot.x -= getLocalPlayer().recoilAnimY * getConfig().recoilMlt;
  rot.x -= getLocalPlayer().landBobY * 0.1;
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
