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
import { isEnemy, pos2D, getXDire, getDir } from "../krunkerUtil";
import BindHolder, { Bind } from "../menu/components/Bind";
import Select from "../menu/components/Select";
import Switch from "../menu/components/Switch";
import { random } from "lodash";
import type THREE from "three";

const defaultAimbot = "off";
export const defaultBot = false;
const defaultWallbangs = false;
const defaultFrustumCheck = true;
const defaultHitbox = "head";
const defaultAimKey = -1;

/**
 * Get the position that will be aimed at (eg the head)
 */
function playerAimPoint(player: Player, hitbox: string) {
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

function lerp(v0: number, v1: number, t: number) {
  return v0 * (1 - t) + v1 * t;
}

function calcRot(
  rotation: THREE.Vector2,
  target: THREE.Vector3,
  aimbot: string
) {
  const localPlayer = getLocalPlayer();

  const render = getRender();

  const worldPos = render.fpsCamera.getWorldPosition(
    new render.THREE.Vector3()
  );

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

  if (aimbot === "smooth") {
    const smoothFactor = 0.1; // Adjust this value to control the smoothness (0 to 1)

    rotation.set(
      lerp(rotation.x, xDire, smoothFactor),
      lerp(rotation.y, yDire, smoothFactor)
    );
  } else {
    rotation.set(xDire, yDire);
  }

  return rotation;
}

function antiRecoil(rotation: THREE.Vector2) {
  rotation.x -= getRender().shakeY;
  rotation.x -= getLocalPlayer().recoilAnimY * getConfig().recoilMlt;
  rotation.x -= getLocalPlayer().landBobY * 0.1;
}

function validTarget(target: Player) {
  const localPlayer = getLocalPlayer();

  if (target === localPlayer) return false;

  if (!isEnemy(target)) return false;

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

    const frustumCheck = configGet<boolean>(
      "frustumCheck",
      defaultFrustumCheck
    );
    const wallbangs =
      configGet<boolean>("wallbangs", defaultWallbangs) &&
      localPlayer.weapon.pierce !== undefined;
    const hitbox = configGet<string>("hitbox", defaultHitbox);

    const target = game.players.list
      .filter(validTarget)
      .map((player) => playerAimPoint(player, hitbox))
      .filter((point) => {
        if (frustumCheck && !getRender().frustum.containPoint(point))
          return false;

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
      const rotation = new THREE.Vector2(
        inputs[iInputs.xDir] / 1000,
        inputs[iInputs.yDir] / 1000
      );

      calcRot(rotation, target, aimbot);

      antiRecoil(rotation);

      // game.controls.pchObjc.rotation.x = rot.x;
      // game.controls.object.rotation.y = rot.y;
      // game.controls.xDr = game.controls.object.rotation.y % Math.PI2;
      // game.controls.yDr = game.controls.pchObjc.rotation.x % Math.PI2;

      // prevent moving in weird direction
      inputs[iInputs.moveDir] = -1;

      if (aimbot === "silent") {
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
