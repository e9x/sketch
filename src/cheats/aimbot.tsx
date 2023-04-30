import { iInputs } from "../consts";
import {
  getConfig,
  getGame,
  getLocalPlayer,
  getOverlay,
  getRender,
  inputHooks,
  renderHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import {
  entityAlive,
  isEnemy,
  pos2D,
  getXDire,
  getDir,
  getCurrentReload,
  getAimTime,
  getCurrentSwapTime,
  getCurrentReloadTimer,
  isInMenus,
  lerp,
} from "../krunkerUtil";
import BindHolder, { Bind } from "../menu/components/Bind";
import Select from "../menu/components/Select";
import { Set } from "../menu/components/Set";
import Slider from "../menu/components/Slider";
import Switch from "../menu/components/Switch";
import type { SketchConfig } from "../sketchConfig";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import type { AI } from "krunker/AI";
import random from "lodash/random";

// Function to check if a 2D point is inside a circle
function isPointInsideCircle(
  point: THREE.Vector2,
  circleCenter: THREE.Vector2,
  radius: number
) {
  const distance = point.distanceTo(circleCenter);
  return distance <= radius;
}

function drawAimbotCircle(
  context: CanvasRenderingContext2D,
  center: THREE.Vector2,
  radius: number
): void {
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI2);
  context.strokeStyle = "red"; // Set the stroke color
  context.lineWidth = 2; // Set the stroke width
  context.stroke();
}

/**
 * Get the position that will be aimed at (eg the head)
 */
function playerAimPoint(player: Player) {
  const hitbox = sketchConfig.get("hitbox");
  const config = getConfig();
  const { THREE } = getGame();
  const hitboxOffset =
    hitbox === "head"
      ? config.headScale / 2
      : config.playerHeight - config.headScale - config.legHeight;

  return new THREE.Vector3(
    player.x,
    player.y +
      player.height -
      hitboxOffset -
      player.crouchVal * config.crouchDst,
    player.z
  );
}

function calcRot(rotation: THREE.Vector2, target: THREE.Vector3) {
  const aimbot = sketchConfig.get("aimbot");
  const smoothFactor = sketchConfig.get("smoothFactor");

  const game = getGame();
  const render = getRender();
  const localPlayer = getLocalPlayer();
  const config = getConfig();

  const { THREE } = render;

  rotation.setX(
    (getXDire(
      game.controls.object.position.x,
      game.controls.object.position.y,
      game.controls.object.position.z,
      target.x,
      target.y,
      target.z
    ) || 0) -
      localPlayer.recoilAnimY * config.recoilMlt
  );

  rotation.setY(
    getDir(
      game.controls.object.position.z,
      game.controls.object.position.x,
      target.z,
      target.x
    ) || 0
  );

  if (aimbot === "smooth")
    lerp(
      rotation,
      new THREE.Vector2(
        game.controls.pchObjc.rotation.x,
        game.controls.object.rotation.y
      ),
      smoothFactor
    );

  return rotation;
}

function validTarget(target: Player | AI) {
  if (!entityAlive(target)) return false;

  if (!isEnemy(target)) return false;

  if (!target.canBSeen) return false;

  return true;
}

function validPoint(point: THREE.Vector3, center: THREE.Vector2) {
  // const game = getGame();
  const render = getRender();
  const localPlayer = getLocalPlayer();

  const fovCheck = sketchConfig.get("fovCheck");
  // const wallbangs =
  sketchConfig.get("wallbangs") && localPlayer.weapon.pierce !== undefined;

  if (fovCheck) {
    if (!render.frustum.containPoint(point)) return false;

    const fovRadius = sketchConfig.get("fovRadius");

    // TODO: reuse pos2D
    if (!isPointInsideCircle(pos2D(point), center, fovRadius)) {
      return false;
    }
  }

  /*if (wallbangs) setMapObjectTransparencyHook(true);

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
*/

  // if (cs !== null) return false;

  return true;
}

export function aimbotHook() {
  let reloading = 0;

  renderHooks.push(() => {
    const drawFOV = sketchConfig.get("drawFOV");
    if (!drawFOV) return;
    if (isInMenus()) return;
    const localPlayer = getLocalPlayer();
    if (!localPlayer.active && !window.spectating) return;
    const fovRadius = sketchConfig.get("fovRadius");

    const overlay = getOverlay();

    if (drawFOV) {
      overlay.ctx.save();
      overlay.ctx.scale(overlay.scale, overlay.scale);
      const { THREE } = getGame();
      const center = new THREE.Vector2(
        innerWidth / overlay.scale / 2,
        innerHeight / overlay.scale / 2
      );
      drawAimbotCircle(overlay.ctx, center, fovRadius);
      overlay.ctx.restore();
    }
  });

  inputHooks.push((inputs) => {
    const bot = sketchConfig.get("bot");

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
  let aimKeyHeld = false;

  inputHooks.push((inputs) => {
    const aimbot = sketchConfig.get("aimbot");
    const aimKey = sketchConfig.get("aimKey");
    const game = getGame();
    const { THREE } = game;

    if (
      aimbot === "off" ||
      (aimKey !== -1 && game.controls.keys[aimKey] !== 1)
    ) {
      targetPlayer = undefined;
      aimKeyHeld = false;
      return;
    }

    const localPlayer = getLocalPlayer();

    // if (inputs[iInputs.frame] % 10 === 0) console.log(currentReload);
    const bot = sketchConfig.get("bot");

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
          if (!bot && !inputs[iInputs.shoot]) return;
          break;
        case "smooth":
          if (!inputs[iInputs.scope]) return;
          break;
      }
    }

    // if the weapon can't shoot
    // maybe use cantShootTimer?
    if (aimbot === "silent") {
      const aimTime = getAimTime(inputs);

      // 295.js: if (this.reloads[this.loadoutIndex] <= 0 && this.swapTime <= 0 && this.reloadTimer <= 0) {
      if (
        getCurrentReload(aimTime) > 0 ||
        getCurrentSwapTime(aimTime) > 0 ||
        getCurrentReloadTimer(aimTime) > 0
      )
        return;
    }

    if (targetPlayer && !validTarget(targetPlayer)) targetPlayer = undefined;

    let target: THREE.Vector3 | undefined;

    const overlay = getOverlay();

    const center = new THREE.Vector2(
      innerWidth / overlay.scale / 2,
      innerHeight / overlay.scale / 2
    );

    if (targetPlayer) {
      target = playerAimPoint(targetPlayer);
      if (!validPoint(target, center)) {
        target = undefined;
        targetPlayer = undefined;
      }
    }

    // do this logic only after checking stuff such as aimbot silent and timer
    const canPickTarget =
      !sketchConfig.get("targetOnAimKey") || aimKey === -1 || !aimKeyHeld;

    aimKeyHeld = true;

    if (!targetPlayer && canPickTarget) {
      const found = game.players.list
        .filter(validTarget)
        .map((player) => ({ player, point: playerAimPoint(player) }))
        .filter(({ point }) => validPoint(point, center))
        .map(({ player, point }) => ({ player, screen: pos2D(point), point }))
        .sort(
          (p1, p2) =>
            p1.screen.distanceTo(center) - p2.screen.distanceTo(center)
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

      const render = getRender();

      // game.controls.pchObjc.rotation.x = rot.x;
      // game.controls.object.rotation.y = rot.y;
      // game.controls.xDr = game.controls.object.rotation.y % Math.PI2;
      // game.controls.yDr = game.controls.pchObjc.rotation.x % Math.PI2;

      // prevent moving in weird direction
      if (aimbot === "silent") {
        if (bot) inputs[iInputs.moveDir] = -1;
        inputs[iInputs.xDir] = rotation.x * 1000;
        inputs[iInputs.yDir] = rotation.y * 1000;
      } else {
        game.controls.pchObjc.rotation.x = rotation.x;
        game.controls.object.rotation.y = rotation.y;

        render.updateFrustum();
      }
    }
  });
}

export function AimbotMenu() {
  const [aimbot, setAimbot] = useSketchConfig("aimbot");
  const [bot, setBot] = useSketchConfig("bot");
  const [fovCheck, setfovCheck] = useSketchConfig("fovCheck");
  const [wallbangs, setWallbangs] = useSketchConfig("wallbangs");
  const [hitbox, setHitbox] = useSketchConfig("hitbox");
  const [aimKey, setAimKey] = useSketchConfig("aimKey");
  const [smoothFactor, setSmoothFactor] = useSketchConfig("smoothFactor");
  const [fovRadius, setFOVRadius] = useSketchConfig("fovRadius");
  const [drawFOV, setDrawFOV] = useSketchConfig("drawFOV");
  const [targetOnAimKey, setTargetAimOnKey] = useSketchConfig("targetOnAimKey");

  return (
    <>
      <Set title="Aimbot">
        <BindHolder title="Aim Key">
          <Bind
            bind={aimKey}
            setBind={(bind) => setAimKey(bind)}
            reset={() => setAimKey()}
            unbind={() => setAimKey(-1)}
          />
        </BindHolder>
        <Select
          title="Aimbot"
          defaultValue={aimbot}
          onChange={(event) =>
            setAimbot(event.currentTarget.value as SketchConfig["aimbot"])
          }
        >
          <option value="off">Off</option>
          <option value="smooth">Smooth</option>
          <option value="silent">Silent</option>
        </Select>
        <Switch
          title="Target on Aim Key"
          description="Picks a target as soon as the aim key is pressed, and won't lock onto a new target until it's pressed again."
          defaultChecked={targetOnAimKey}
          onChange={(event) => setTargetAimOnKey(event.currentTarget.checked)}
        />
        <Slider
          title="Smooth Factor"
          description="Controls the speed of the aimbot's rotation"
          defaultValue={smoothFactor}
          min={0}
          max={1}
          step={0.05}
          onChange={(event) =>
            setSmoothFactor(event.currentTarget.valueAsNumber)
          }
        />
        <Switch
          title="Wallbangs"
          defaultChecked={wallbangs}
          onChange={(event) => setWallbangs(event.currentTarget.checked)}
        />
        <Select
          title="Hitbox"
          description="Automatically aim and fire at players"
          defaultValue={hitbox}
          onChange={(event) =>
            setHitbox(event.currentTarget.value as SketchConfig["hitbox"])
          }
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
      </Set>
      <Set title="FOV">
        <Switch
          title="FOV check"
          description="Checks if enemies are in your field of view"
          defaultChecked={fovCheck}
          onChange={(event) => setfovCheck(event.currentTarget.checked)}
        />
        <Slider
          title="FOV Radius"
          description="Controls the aimbot FOV"
          defaultValue={fovRadius}
          min={0}
          max={500}
          step={5}
          onChange={(event) => setFOVRadius(event.currentTarget.valueAsNumber)}
        />
        <Switch
          title="Show FOV"
          description="Visualizes your FOV"
          defaultChecked={drawFOV}
          onChange={(event) => setDrawFOV(event.currentTarget.checked)}
        />
      </Set>
    </>
  );
}
