import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import {
  getConfig,
  getGame,
  getLocalPlayer,
  getOverlay,
  getRender,
  inputHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import { isEnemy, pos2D, getXDire, getDir } from "../krunkerUtil";
import Select from "../menu/components/Select";
import Switch from "../menu/components/Switch";
import type THREE from "three";

const defaultAimbot = "off";
export const defaultBot = false;
const defaultWallbangs = false;
const defaultFrustumCheck = true;

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

function antiRecoil(rot: THREE.Vector2) {
  rot.x -= getRender().shakeY;
  rot.x -= getLocalPlayer().recoilAnimY * getConfig().recoilMlt;
  rot.x -= getLocalPlayer().landBobY * 0.1;
}

function validTarget(target: Player) {
  const localPlayer = getLocalPlayer();

  if (target === localPlayer) return false;

  if (!isEnemy(target)) return false;

  return true;
}

export function aimbotHook() {
  // let target: Player | undefined;

  inputHooks.push((inputs) => {
    const aimbot = configGet("aimbot", defaultAimbot);

    if (aimbot === "off") return;

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
    const bot = configGet("bot", defaultBot);

    if (bot) {
      if (localPlayer.weapon.noAim === false) {
        inputs[iInputs.scope] = 1;

        // not fully aimed
        if (localPlayer.aimVal) return;
      }
    } else {
      // require user input
      if (!inputs[iInputs.shoot]) return;
    }

    // if the weapon can't shoot
    // maybe use cantShootTimer?
    if (currentReload || localPlayer.reloadTimer) return;

    const overlayCenter = new game.THREE.Vector2(
      overlay.canvas.width / 2,
      overlay.canvas.height / 2
    );

    const frustumCheck = configGet("frustumCheck", defaultFrustumCheck);
    const wallbangs =
      configGet("wallbangs", defaultWallbangs) &&
      localPlayer.weapon.pierce !== undefined;

    const target = game.players.list
      .filter(validTarget)
      .map((player) => playerAimPoint(player))
      .filter((point) => {
        if (frustumCheck && !getRender().frustum.containPoint(point))
          return false;

        if (game.canSee(localPlayer, point.x, point.y, point.z) !== null)
          return false;

        return true;
      })
      .map((point) => ({ screen: pos2D(point), point }))
      .sort(
        (p1, p2) =>
          p1.screen.distanceTo(overlayCenter) -
          p2.screen.distanceTo(overlayCenter)
      )[0]?.point;

    if (target) {
      if (bot) inputs[iInputs.shoot] = 1;

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
  const [bot, setBot] = useConfig("bot", defaultBot);
  const [frustumCheck, setFrustumCheck] = useConfig(
    "frustumCheck",
    defaultFrustumCheck
  );
  const [wallbangs, setWallbangs] = useConfig("wallbangs", defaultWallbangs);

  return (
    <>
      <Select
        title="Aimbot"
        defaultValue={aimbot}
        onChange={(event) => setAimbot(event.currentTarget.value)}
      >
        <option value="off">Off</option>
        <option value="silent">Silent</option>
        <option value="smooth">Smooth</option>
      </Select>
      <Switch
        title="Wallbangs"
        defaultChecked={wallbangs}
        onChange={(event) => setWallbangs(event.currentTarget.checked)}
      />
      <Switch
        title="FOV check"
        description="Checks if enemies are in your field of view"
        defaultChecked={frustumCheck}
        onChange={(event) => setFrustumCheck(event.currentTarget.checked)}
      />
      <Switch
        title="Turret"
        description="Automatically aim and fire at players"
        defaultChecked={bot}
        onChange={(event) => setBot(event.currentTarget.checked)}
      />
    </>
  );
}
