import { useEffect, useRef, useState } from "preact/hooks";
import { iInputs } from "../consts";
import {
  canISeeEnt,
  getConfig,
  getGame,
  getLocalPlayer,
  getOverlay,
  getRender,
  inputHooks,
  overlayRenderHooks,
} from "../filters";
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
  getOverlaySizeScaled,
  get3Ddistance,
} from "../krunkerUtil";
import type { Player } from "../krunker/Player";
import sketchConfig, {
  useSketchConfig,
  type AimbotTarget,
  type SketchConfig,
} from "../sketchConfig";
import { random } from "../util";
import { ForceAutoMenu } from "./forceAuto";
import { RecoilControlMenu } from "./recoilControl";
import { TriggerbotMenu } from "./triggerbot";
import { BindHolder, Bind } from "../krunker-ui/components/Bind";
import { Control } from "../krunker-ui/components/Control";
import { Select } from "../krunker-ui/components/Select";
import { HeadlessSet, Set } from "../krunker-ui/components/Set";
import { Slider } from "../krunker-ui/components/Slider";
import { Switch } from "../krunker-ui/components/Switch";
import type { AI } from "../krunker/AI";
import type * as THREE from "three";
import { keyListeners } from "../keys";

// optimize call (tampermonkey is slow)
// ^-- don't listen to him
const { Math } = window;

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

function playerHitbox(player: Player, hitbox: string) {
  const config = getConfig();
  // const localPlayer = getLocalPlayer();
  // const game = getGame();
  // if (sketchConfig.get("multiPoint")) {
  //   const mpScale = sketchConfig.get("multiPointScale");

  //   const dimensions = {
  //     x: player.x,
  //     y: player.y,
  //     z: player.z,
  //     w: player.height * 0.5,
  //     h: player.height - player.crouchVal * config.crouchDst - 0.2,
  //   };

  //   // start at 2/3 (chest) or 3/3 (top) when
  //   for (let y = hitbox === "chest" ? 2 : 3; y > 0; y--) {
  //     for (let x = 0; x < 3; x++) {
  //       for (let z = 0; z < 3; z++) {
  //         const lineEnd = new game.THREE.Vector3(
  //           player.x +
  //             dimensions.w * (x ? (x % 2 === 0 ? -1 : 1) * 0.5 : 0) * mpScale,
  //           player.y + dimensions.h * (y / 3),
  //           player.z +
  //             dimensions.w * (z ? (z % 2 === 0 ? -1 : 1) * 0.5 : 0) * mpScale
  //         );
  //         const intersects =
  //           game.canSee(localPlayer, lineEnd.x, lineEnd.y, lineEnd.z) === null;
  //         if (intersects) return lineEnd;
  //       }
  //     }
  //   }
  // } else {
  const { THREE } = getGame();

  if (hitbox === "head") {
    const lol = new THREE.Vector3();
    player.upperBody?.getWorldPosition(lol);
    // lol.y += config.headScale / 2;
    return lol;
  }

  if (hitbox === "chest") {
    const lol = new THREE.Vector3();
    player.headObj?.getWorldPosition(lol);
    // lol.y += config.headScale / 2;
    return lol;
  }

  const hitboxOffset =
    hitbox === "head"
      ? config.headScale / 2
      : hitbox === "chest"
        ? config.playerHeight - config.headScale - config.legHeight
        : config.legHeight / 2;

  return new THREE.Vector3(
    player.x,
    player.y +
    player.height -
    hitboxOffset -
    player.crouchVal * config.crouchDst,
    player.z
  );
  // }
}

/**
 * Get the position that will be aimed at (eg the head)
 */
function playerAimPoint(player: Player) {
  const hitbox = sketchConfig.get("hitbox");
  // const bot = sketchConfig.get("bot");

  // absolute top
  // if (bot && ["auto", "head"].includes(hitbox)) {
  //   const config = getConfig();
  //   const { THREE } = getGame();

  //   return new THREE.Vector3(
  //     player.x,
  //     player.y + player.height - player.crouchVal * config.crouchDst,
  //     player.z
  //   );
  // }

  if (hitbox === "auto") {
    const points = [
      playerHitbox(player, "head"),
      playerHitbox(player, "chest"),
      playerHitbox(player, "feet"),
    ];
    const { THREE } = getGame();
    const overlaySize = getOverlaySizeScaled();
    const center = new THREE.Vector2(
      overlaySize.width / 2,
      overlaySize.height / 2
    );
    // get 2d version of 3d by pos2D(point)
    // return the point that is nearest to the center pls

    // Calculate the distance from the center for each point
    const distances = (points.filter(Boolean) as THREE.Vector3[]).map(
      (point) => {
        const screen = pos2D(point);
        return {
          point,
          screen,
          distance: center.distanceTo(screen),
        };
      }
    );

    // Sort by distance
    const near = distances.sort((a, b) => a.distance - b.distance)[0];
    // Return the nearest point
    return near?.point;
  }

  return playerHitbox(player, hitbox);
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

  if (target.isPlayer && target.isYou) return false;

  if (!isEnemy(target)) return false;

  if (!canISeeEnt(target)) return false;

  return true;
}

function onTargetList(target: Player) {
  const targetListMode = sketchConfig.get("targetListMode");

  if (targetListMode === "guestOnly")
    return target.name === "Guest_" + target.sid;

  // If targetListMode is off, immediately allow the target
  if (targetListMode === "off") return true;

  const targetList = sketchConfig.get("targetList");
  let found = false;

  for (const e of targetList) {
    // If the second element of the entry (e[1]) is empty and matches the target name
    // set it to the target ID
    if (e[1] === "" && target.name === e[0]) {
      // Assuming e[0] holds the player name
      console.log("Identified target", e, target.name, target.id);
      e[1] = target.id.toString();
      sketchConfig.set("targetList", targetList);
    }

    // Check if the target's ID is in the target list
    if (e[1] === target.id.toString()) {
      found = true;
      break; // Exit loop early if target ID is found
    }
  }

  // Determine the return value based on the list mode
  if (targetListMode === "blacklist") {
    return !found; // Returns false if found, true if not found
  } else {
    return found; // Returns true if found (whitelist mode)
  }
}

function validPoint(point: THREE.Vector3, center: THREE.Vector2) {
  // const game = getGame();
  const render = getRender();

  const fovCheck = sketchConfig.get("fovCheck");

  if (fovCheck) {
    if (!render.frustum.containPoint(point)) return false;

    const fovRadius = sketchConfig.get("fovRadius");

    // TODO: reuse pos2D
    if (!isPointInsideCircle(pos2D(point), center, fovRadius)) {
      return false;
    }
  }

  return true;
}

declare global {
  function SSpinbot(inputs: number[], i: typeof iInputs, sk: typeof sketchConfig): void;
}

export function aimbotHook() {
  let reloading = 0;

  overlayRenderHooks.push(() => {
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
      const overlaySize = getOverlaySizeScaled();
      const center = new THREE.Vector2(
        overlaySize.width / 2,
        overlaySize.height / 2
      );
      drawAimbotCircle(overlay.ctx, center, fovRadius);
      overlay.ctx.restore();
    }
  });

  keyListeners.push((event, code, down) => {
    const toggleAimbotKey = sketchConfig.get("toggleAimbotKey");
    if (toggleAimbotKey !== -1 && code === toggleAimbotKey && down) {
      event.preventDefault();
      sketchConfig.set("aimbotEnabled", !sketchConfig.get("aimbotEnabled"));
    }
  });

  // bot auto reload
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

  let aimReaction = 0;
  let didAim = false;
  let lastDidAim = false;
  let doSpinbot = false;

  inputHooks.push((inputs) => {
    doSpinbot = true;
    const aimbot = sketchConfig.get("aimbot");
    const aimReactionTime = sketchConfig.get("aimReactionTime") * 1000;
    const aimKey = sketchConfig.get("aimKey");
    const game = getGame();
    const { THREE } = game;

    lastDidAim = didAim;
    didAim = false;

    const aimbotEnabled = sketchConfig.get("aimbotEnabled")

    if (
      !aimbotEnabled ||
      (aimKey !== -1 && game.controls.keys[aimKey] !== 1)
    ) {
      targetPlayer = undefined;
      aimKeyHeld = false;
      return;
    }

    const localPlayer = getLocalPlayer();

    const bot = sketchConfig.get("bot");
    const botAim = sketchConfig.get("botAim");

    if (bot) {
      if (botAim && localPlayer.weapon.noAim === false) {
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

      if (aimReactionTime) {
        // just now aimed, set aimReaction
        if (!lastDidAim) aimReaction = Date.now();

        didAim = true;
        lastDidAim = true;

        if (Date.now() - aimReaction < aimReactionTime) return;
      }
    }

    if (
      targetPlayer &&
      (!validTarget(targetPlayer) || !game.players.list.includes(targetPlayer))
    )
      targetPlayer = undefined;

    let target: THREE.Vector3 | undefined;

    const overlay = getOverlay();

    const center = new THREE.Vector2(
      innerWidth / overlay.scale / 2,
      innerHeight / overlay.scale / 2
    );

    if (targetPlayer) {
      target = playerAimPoint(targetPlayer);
      if (!target || !validPoint(target, center)) {
        target = undefined;
        targetPlayer = undefined;
      }
    }

    // do this logic only after checking stuff such as aimbot silent and timer
    const canPickTarget =
      !sketchConfig.get("targetOnAimKey") || aimKey === -1 || !aimKeyHeld;

    aimKeyHeld = true;

    if (!targetPlayer && canPickTarget) {
      const render = getRender();
      const fovCheck = sketchConfig.get("fovCheck");

      const found = (
        game.players.list

          .filter(validTarget)
          .filter(onTargetList)
          .map((player) => ({ player, point: playerAimPoint(player) }))
          .filter(({ point }) => point && validPoint(point, center)) as {
            player: Player;
            point: THREE.Vector3;
          }[]
      )
        .map(({ player, point }) => ({
          player,
          screen: pos2D(point),
          point,
          inFrustum: fovCheck ? false : render.frustum.containsPoint(point),
        }))
        .sort((p1, p2) => {
          const distComparison =
            p1.screen.distanceTo(center) - p2.screen.distanceTo(center);

          // no fovCheck = we'll at least weigh the players based on if they're in the FOV
          if (!fovCheck) {
            // prefer things on screen
            const p1InFrustum = p1.inFrustum ? 0 : 1;
            const p2InFrustum = p2.inFrustum ? 0 : 1;

            return distComparison + p1InFrustum - p2InFrustum;
          }

          return distComparison;
        })[0];

      if (found) {
        targetPlayer = found.player;
        target = found.point;
      }
    }

    if (target && aimbot === "silent") {
      // not fully aimed
      inputs[iInputs.scope] = 1;
      if (localPlayer.weapon.noAim === false && localPlayer.aimVal) {
        return;
      }
    }

    // if the weapon can't shoot
    // maybe use cantShootTimer?
    const aimTime = getAimTime(inputs);

    // 295.js: if (this.reloads[this.loadoutIndex] <= 0 && this.swapTime <= 0 && this.reloadTimer <= 0) {
    if (
      getCurrentReload(aimTime) > 0 ||
      getCurrentSwapTime(aimTime) > 0 ||
      getCurrentReloadTimer(aimTime) > 0
    ) {
      if (aimbot === "silent") return;
    } else {
      // OHH SHIEET QWE ABOUT TO KILL A KRUNKA
      doSpinbot = false;
    }

    if (target) {
      const see = get3Ddistance(
        localPlayer.x,
        localPlayer.y,
        localPlayer.z,
        target.x,
        target.y,
        target.z
      );

      if (
        localPlayer.weapon.melee &&
        localPlayer.weapon.range! < see &&
        !localPlayer.canThrow
      )
        return;

      if (bot && aimbot === "silent") {
        inputs[iInputs.shoot] = 1;
      }

      const rotation = new THREE.Vector2(
        inputs[iInputs.xDir] / 1000,
        inputs[iInputs.yDir] / 1000
      );

      calcRot(rotation, target);

      const render = getRender();

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

  let v = 1;

  let spinCount = 0;

  inputHooks.push((inputs) => {
    if (window.SSpinbot) {
      try {
        window.SSpinbot(inputs, iInputs, sketchConfig);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    const sb = sketchConfig.get("spinbot");
    const mlt = 84;

    const lp = getLocalPlayer();
    // idek what part of the body this is
    const p1 = lp.lowerBody?.children[1];
    const p2 = lp.headObj;
    const p3 = lp.objInstances?.children[0];
    const p4 = lp.faceMesh;
    if (sb === "off") {
      if (p1) p1.rotation.x = 0;
      if (p2) p2.rotation.x = 0;
      if (p3) p3.rotation.y = 0;
      if (p4) p4.rotation.x = 0;
      return;
    }

    if (p1) p1.rotation.x = -1;
    if (p2) p2.rotation.x = -1;
    if (p3) p3.rotation.y = Math.random() * 1000;
    if (p4) p4.rotation.x = -1;


    // inputs[iInputs.shoot]
    if (!doSpinbot) return;

    switch (sb) {
      case "physical":
        if (inputs[iInputs.moveDir] !== -1)
          inputs[iInputs.moveDir] =
            (inputs[iInputs.moveDir] +
              spinCount -
              Math.round(7 * (inputs[iInputs.yDir] / 1000 / (Math.PI * 2)))) %
            7;
        // crouch while not moving
        else if (sketchConfig.get("botCrouch")) inputs[iInputs.crouch] = 1;
        inputs[iInputs.xDir] = (-Math.PI / 2) * 1000;
        inputs[iInputs.yDir] = (spinCount / 7) * (Math.PI * 2) * 1000;
        if (inputs[iInputs.frame] % 1 === 0) spinCount = (spinCount + 1) % 7;
        break;
      case "visual":
        // force down
        inputs[iInputs.xDir] = (-Math.PI / 2) * 1000;
        // abuse animations
        v ^= 1;
        if (v === 1)
          inputs[iInputs.yDir] -= (Math.PI / 2) * 1000 * mlt;
        break;
    }
  });
}

export function AimbotMenu() {
  const [aimbot, setAimbot] = useSketchConfig("aimbot");
  const [aimbotEnabled, setAimbotEnabled] = useSketchConfig("aimbotEnabled");
  const [toggleAimbotKey, setToggleAimbotKey] = useSketchConfig("toggleAimbotKey");
  const [bot, setBot] = useSketchConfig("bot");
  const [botCrouch, setBotCrouch] = useSketchConfig("botCrouch");
  const [botAim, setBotAim] = useSketchConfig("botAim");
  const [fovCheck, setfovCheck] = useSketchConfig("fovCheck");
  const [wallbangs, setWallbangs] = useSketchConfig("wallbangs");
  const [hitbox, setHitbox] = useSketchConfig("hitbox");
  const [aimKey, setAimKey] = useSketchConfig("aimKey");
  const [aimReactionTime, setAimReactionTime] =
    useSketchConfig("aimReactionTime");
  const [smoothFactor, setSmoothFactor] = useSketchConfig("smoothFactor");
  const [fovRadius, setFOVRadius] = useSketchConfig("fovRadius");
  const [drawFOV, setDrawFOV] = useSketchConfig("drawFOV");
  // const [multiPoint, setMultiPoint] = useSketchConfig("multiPoint");
  // const [multiPointScale, setMultiPointScale] = useSketchConfig("multiPointScale");
  const [targetOnAimKey, setTargetAimOnKey] = useSketchConfig("targetOnAimKey");
  const [spinbot, setSpinbot] = useSketchConfig("spinbot");
  const [targetListMode, setTargetListMode] = useSketchConfig("targetListMode");
  const [targetList, setTargetList] = useSketchConfig("targetList");
  const [targets, setTargets] = useState<AimbotTarget[]>([]);
  const addTargetList = useRef<HTMLSelectElement | null>(null);
  const [mouseLockX, setMouseLockX] = useSketchConfig("mouseLockX");
  const [mouseLockY, setMouseLockY] = useSketchConfig("mouseLockY");

  useEffect(() => {
    const callback = () => {
      try {
        const game = getGame();
        setTargets(
          game.players.list
            .filter(
              (player) =>
                !player.isYou &&
                targetList.every((target) => target[1] !== player.id.toString())
            )
            .map((player) => [player.name, player.id.toString()])
        );
      } catch (err) {
        console.error(err);
      }
    };
    callback();

    const interval = setInterval(callback, 1e3);
    return () => clearInterval(interval);
  }, [targetList, setTargets]);

  return (
    <>
      <HeadlessSet>
        <ForceAutoMenu />
      </HeadlessSet>
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
          title="Aimbot Type"
          defaultValue={aimbot}
          onChange={(event) =>
            setAimbot(event.currentTarget.value as SketchConfig["aimbot"])
          }
        >
          <option value="smooth">Assist</option>
          <option value="silent">Silent</option>
        </Select>
        <Switch
          title="Aimbot Enabled"
          defaultChecked={aimbotEnabled}
          onChange={(event) =>
            setAimbotEnabled(event.currentTarget.checked)
          } />
        <BindHolder title="Aimbot Toggle Key">
          <Bind
            bind={toggleAimbotKey}
            setBind={(bind) => {
              if (bind === 10001) alert("Invalid bind");
              else setToggleAimbotKey(bind);
            }}
            reset={() => setToggleAimbotKey()}
            unbind={() => setToggleAimbotKey(-1)}
          />
        </BindHolder>
        <Slider
          title="Aim reaction time"
          description="Time before aiming at target after aiming/pressing aim key"
          defaultValue={aimReactionTime}
          min={0}
          max={1}
          step={0.05}
          onChange={(event) =>
            setAimReactionTime(event.currentTarget.valueAsNumber)
          }
        />
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
          max={2}
          step={0.05}
          onChange={(event) =>
            setSmoothFactor(event.currentTarget.valueAsNumber)
          }
        />
        <Select
          title="Hitbox"
          description="Automatically aim and fire at players"
          defaultValue={hitbox}
          onChange={(event) =>
            setHitbox(event.currentTarget.value as SketchConfig["hitbox"])
          }
        >
          <option value="auto">Nearest</option>
          <option value="head">Head</option>
          <option value="chest">Chest</option>
          <option value="feet">Feet</option>
        </Select>
      </Set>
      <Set title="Aimbot Target">
        <Select
          title="Target List Mode"
          defaultValue={targetListMode}
          onChange={(event) =>
            setTargetListMode(
              event.currentTarget.value as SketchConfig["targetListMode"]
            )
          }
        >
          <option value="off">Off</option>
          <option value="guestOnly">Guests only</option>
          <option value="whitelist">Whitelist</option>
          <option value="blacklist">Blacklist</option>
        </Select>
        <Control title="Add player">
          <div
            className="settingsBtn"
            onClick={() => {
              const val = addTargetList.current!.value;
              let target: AimbotTarget | undefined;
              if (val === "") {
                const user = (prompt("What's their username?") || "").trim();
                if (user !== "") target = [user, ""];
              } else target = targets.find((target) => target[1] === val);
              if (!target) return;
              setTargetList([...targetList, target!]);
              addTargetList.current!.value = "";
            }}
          >
            Add
          </div>
          <select className="inputGrey2" ref={addTargetList}>
            <option value="">Pick a player</option>
            {targets.map(([name, id]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
        </Control>
        <div className="settName">
          <table
            className="pListTable"
            style={{
              marginTop: "8px",
              overflowY: "scroll",
              height: "calc(100% - 75px)",
            }}
          >
            <tbody>
              {targetList.map((target) => (
                <tr key={target[1]}>
                  <td className="pListName">{target[0]}</td>
                  <td className="pListActions">
                    <span
                      onMouseEnter={() => playTick()}
                      className="punishButton kick"
                      onClick={() => {
                        setTargetList(
                          targetList.filter((t) => t[1] !== target[1])
                        );
                      }}
                    >
                      Remove
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          min={10}
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
        <Slider
          title={<>Mouse lock % X<span style={{ fontWeight: "bold", color: "inherit", margin: "0 5px", fontStyle: "italic", fontSize: "12px" }}>o7y</span></>}
          description=""
          defaultValue={mouseLockX}
          min={0}
          max={1}
          step={0.005}
          onChange={(event) =>
            setMouseLockX(event.currentTarget.valueAsNumber)
          }
        />
        <Slider
          title={<>Mouse lock % Y<span style={{ fontWeight: "bold", color: "inherit", margin: "0 5px", fontStyle: "italic", fontSize: "12px" }}>o7y</span></>}
          description=""
          defaultValue={mouseLockY}
          min={0}
          max={1}
          step={0.005}
          onChange={(event) =>
            setMouseLockY(event.currentTarget.valueAsNumber)
          }
        />
      </Set>
      {/* <Set title="Multipoint">
        <Switch
          title="Multipoint"
          defaultChecked={multiPoint}
          onChange={(event) => setMultiPoint(event.currentTarget.checked)}
          attention
          description="Improves aimbot accuracy. Has a small performance cost"
        />
        <Slider
          title="Multipoint Scale"
          description="Lower is closer to the center, higher is closer to the edges"
          min={0}
          max={1}
          step={0.1}
          defaultValue={multiPointScale}
          onChange={(event) =>
            setMultiPointScale(event.currentTarget.valueAsNumber)
          }
        />
      </Set> */}
      <Set title="Rage">
        <Switch
          title="Turret"
          description="Automatically fires at players"
          defaultChecked={bot}
          onChange={(event) => setBot(event.currentTarget.checked)}
        />
        <Switch
          title="Auto-Crouch"
          description="Decreases hitbox size"
          defaultChecked={botCrouch}
          onChange={(event) => setBotCrouch(event.currentTarget.checked)}
        />
        <Switch
          title="Turret Always Aim"
          description="Automatically aims when in turret mode"
          defaultChecked={botAim}
          onChange={(event) => setBotAim(event.currentTarget.checked)}
        />
        <Switch
          title="Wallbangs"
          defaultChecked={wallbangs}
          onChange={(event) => setWallbangs(event.currentTarget.checked)}
        />
        <Select
          title="Spinbot Type"
          defaultValue={spinbot}
          onChange={(event) =>
            setSpinbot(event.currentTarget.value as SketchConfig["spinbot"])
          }
        >
          <option value="off">Off</option>
          <option value="physical">Physical</option>
          <option value="visual">Visual</option>
        </Select>
      </Set>
      <Set title="Triggerbot">
        <TriggerbotMenu />
      </Set>
      <Set title="Recoil Control">
        <RecoilControlMenu />
      </Set>
    </>
  );
}
