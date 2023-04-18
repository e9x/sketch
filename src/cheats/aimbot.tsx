import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import {
  getConfig,
  getGame,
  getLocalPlayer,
  getOverlay,
  getRender,
  inputHooks,
  setMapObjectTransparencyHook,
} from "../filters";
import type { Player } from "../krunker/Player";
import { isEnemy, pos2D, getXDire, getDir, getAngleDst } from "../krunkerUtil";
import BindHolder, { Bind } from "../menu/components/Bind";
import Select from "../menu/components/Select";
import Slider from "../menu/components/Slider";
import Switch from "../menu/components/Switch";
import random from "lodash/random";

const defaultAimbot = "off";
export const defaultBot = false;
const defaultWallbangs = false;
const defaultFrustumCheck = true;
const defaultHitbox = "head";
const defaultAimKey = -1;
const defaultSmoothFactor = 0.1;

/**
 * Get the position that will be aimed at (eg the head)
 */
function playerAimPoint(player: Player) {
  const hitbox = configGet<string>("hitbox", defaultHitbox);
  const config = getConfig();
  const game = getGame();
  const { THREE } = game;
  const hitboxOffset =
    hitbox === "head"
      ? config.headScale / 2
      : config.playerHeight - config.headScale - config.legHeight;

  return new THREE.Vector3(
    player.x,
    player.y +
      player.height -
      hitboxOffset -
      player.crouchVal * config.crouchAnimMlt,
    player.z
  );
}

function calcRot(rotation: THREE.Vector2, target: THREE.Vector3) {
  const aimbot = configGet<string>("aimbot", defaultAimbot);
  const smoothFactor = configGet<number>("smoothFactor", defaultSmoothFactor);

  const game = getGame();
  const render = getRender();
  const localPlayer = getLocalPlayer();
  const config = getConfig();

  const { THREE } = render;

  const yD =
    getDir(
      game.controls.object.position.z,
      game.controls.object.position.x,
      target.z,
      target.x
    ) || 0;

  const xD =
    (getXDire(
      game.controls.object.position.x,
      game.controls.object.position.y,
      game.controls.object.position.z,
      target.x,
      target.y,
      target.z
    ) || 0) -
    localPlayer.recoilAnimY * config.recoilMlt;

  const targetRotation = new THREE.Vector2(xD, yD);

  if (aimbot === "smooth") {
    rotation.x +=
      getAngleDst(game.controls.pchObjc.rotation.x, xD) * smoothFactor;
    rotation.y +=
      getAngleDst(game.controls.object.rotation.y, yD) * smoothFactor;
    render.updateFrustum();
  } else {
    targetRotation.copy(rotation);
  }

  return rotation;
}

function validTarget(target: Player) {
  const localPlayer = getLocalPlayer();

  if (target === localPlayer) return false;

  if (!isEnemy(target)) return false;

  return true;
}

function validPoint(point: THREE.Vector3) {
  const game = getGame();
  const render = getRender();
  const localPlayer = getLocalPlayer();
  const frustumCheck = configGet<boolean>("frustumCheck", defaultFrustumCheck);
  const wallbangs =
    configGet<boolean>("wallbangs", defaultWallbangs) &&
    localPlayer.weapon.pierce !== undefined;

  if (frustumCheck && !render.frustum.containPoint(point)) return false;

  if (wallbangs) setMapObjectTransparencyHook(true);

  const cs = game.canSee(
    localPlayer,
    point.x,
    point.y,
    point.z,
    undefined,
    undefined,
    // this sets the transparency value to the penetrable value, so this will skip all the penetrable values here
    // can't just copy the canSee function because when stolen and used, it's sooo slow
    wallbangs ? true : undefined
  );
  if (wallbangs) setMapObjectTransparencyHook(false);

  if (cs !== null) return false;

  return true;
}

export function aimbotHook() {
  let reloading = 0;

  inputHooks.push((inputs) => {
    const bot = configGet<boolean>("bot", defaultBot);

    if (!bot) return;

    const localPlayer = getLocalPlayer();

    // check if we already sent the reload input so we don't spam the reload input
    if (!localPlayer.ammos[localPlayer.loadoutIndex]) {
      // keep sending the input until we hit the "time limit" for reloading, declared when reloading = ...
      if (reloading === 0 || inputs[iInputs.frame] < reloading) {
        inputs[iInputs.reload] = 1;

        // reload for a random amount of frames to simulate pressing it
        // set reloading only as soon as we start holding the input down
        if (reloading === 0) reloading = inputs[iInputs.frame] + random(3, 8);
      }
    } else reloading = 0;
  });

  let targetPlayer: Player | undefined;

  inputHooks.push((inputs) => {
    const aimbot = configGet<string>("aimbot", defaultAimbot);
    const aimKey = configGet<number>("aimKey", defaultAimKey);
    const game = getGame();
    const { THREE } = game;

    if (aimbot === "off" || (aimKey !== -1 && game.controls.keys[aimKey] !== 1))
      return;

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
    const bot = configGet<boolean>("bot", defaultBot);

    if (bot) {
      if (localPlayer.weapon.noAim === false) {
        inputs[iInputs.scope] = 1;

        // not fully aimed
        if (localPlayer.aimVal) return;
      }
    } else {
      // require user input
      switch (aimbot) {
        case "silent":
          if (!inputs[iInputs.shoot]) return;
          break;
        case "smooth":
          if (!inputs[iInputs.scope]) return;
          break;
      }
    }

    // if the weapon can't shoot
    // maybe use cantShootTimer?
    if (aimbot === "silent" && (currentReload || localPlayer.reloadTimer))
      return;

    const overlayCenter = new game.THREE.Vector2(
      overlay.canvas.width / 2,
      overlay.canvas.height / 2
    );

    if (targetPlayer && !validTarget(targetPlayer)) targetPlayer = undefined;

    let target: THREE.Vector3 | undefined;

    if (targetPlayer) {
      target = playerAimPoint(targetPlayer);
      if (!validPoint(target)) {
        target = undefined;
        targetPlayer = undefined;
      }
    }

    if (!targetPlayer) {
      const found = game.players.list
        .filter(validTarget)
        .map((player) => ({ player, point: playerAimPoint(player) }))
        .filter(({ point }) => validPoint(point))
        .map(({ player, point }) => ({ player, screen: pos2D(point), point }))
        .sort(
          (p1, p2) =>
            p1.screen.distanceTo(overlayCenter) -
            p2.screen.distanceTo(overlayCenter)
        )[0];

      if (found) {
        targetPlayer = found.player;
        target = found.point;
      }
    }

    if (target) {
      if (bot) inputs[iInputs.shoot] = 1;

      // console.log("target:", target);
      const rotation = new THREE.Vector2(
        inputs[iInputs.xDir] / 1000,
        inputs[iInputs.yDir] / 1000
      );

      calcRot(rotation, target);

      // game.controls.pchObjc.rotation.x = rot.x;
      // game.controls.object.rotation.y = rot.y;
      // game.controls.xDr = game.controls.object.rotation.y % Math.PI2;
      // game.controls.yDr = game.controls.pchObjc.rotation.x % Math.PI2;

      // prevent moving in weird direction
      if (aimbot === "silent") {
        inputs[iInputs.moveDir] = -1;
        inputs[iInputs.xDir] = rotation.x * 1000;
        inputs[iInputs.yDir] = rotation.y * 1000;
      } else {
        game.controls.pchObjc.rotation.x = rotation.x;
        game.controls.object.rotation.y = rotation.y;
      }
    }
  });
}

export function AimbotMenu() {
  const [aimbot, setAimbot] = useConfig<string>("aimbot", defaultAimbot);
  const [bot, setBot] = useConfig<boolean>("bot", defaultBot);
  const [frustumCheck, setFrustumCheck] = useConfig<boolean>(
    "frustumCheck",
    defaultFrustumCheck
  );
  const [wallbangs, setWallbangs] = useConfig<boolean>(
    "wallbangs",
    defaultWallbangs
  );
  const [hitbox, setHitbox] = useConfig<string>("hitbox", defaultHitbox);
  const [aimKey, setAimKey] = useConfig<number>("aimKey", defaultAimKey);
  const [smoothFactor, setSmoothFactor] = useConfig<number>(
    "smoothFactor",
    defaultSmoothFactor
  );

  return (
    <>
      <BindHolder title="Aim Key">
        <Bind
          bind={aimKey}
          setBind={(bind) => setAimKey(bind)}
          reset={() => setAimKey(null)}
          unbind={() => setAimKey(-1)}
        />
      </BindHolder>
      <Select
        title="Aimbot"
        defaultValue={aimbot}
        onChange={(event) => setAimbot(event.currentTarget.value)}
      >
        <option value="off">Off</option>
        <option value="smooth">Smooth</option>
        <option value="silent">Silent</option>
      </Select>
      <Slider
        title="Smooth Factor"
        description="Controls the speed of the aimbot's rotation"
        defaultValue={smoothFactor}
        min={0.01}
        max={0.1}
        step={0.01}
        onChange={(event) => setSmoothFactor(event.currentTarget.valueAsNumber)}
      />
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
      <Select
        title="Hitbox"
        description="Automatically aim and fire at players"
        defaultValue={hitbox}
        onChange={(event) => setHitbox(event.currentTarget.value)}
      >
        <option value="head">Head</option>
        <option value="chest">Chest</option>
      </Select>
      <Switch
        title="Turret"
        description="Automatically aim and fire at players"
        defaultChecked={bot}
        onChange={(event) => setBot(event.currentTarget.checked)}
      />
    </>
  );
}
