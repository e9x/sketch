import { ColorPicker } from "../krunker-ui/components/ColorPicker";
import { getExposedWindow } from "../consts";
import {
  getConfig,
  getGame,
  getOverlay,
  getRender,
  overlayRenderHooks,
  canISeeEnt,
  hitboxPoints,
} from "../filters";
import type { AI } from "../krunker/AI";
import type { Player } from "../krunker/Player";
import type { SpawnPoint } from "../krunker/GameMap";
import {
  entityAlive,
  getOffScreenDir,
  getOverlaySizeScaled,
  getPlayerMeshes,
  isEnemy,
  isInMenus,
  playerPos,
  pos2D,
} from "../krunkerUtil";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";
import type * as THREE from "three";
import { Slider } from "../krunker-ui/components/Slider";
import { sharedRainbowHexColor } from "./playerEditor";

// nametags is handled in index.ts
// see get nametags() { ... }

export class PlayerRectBounds {
  private xMin: number;
  private xMax: number;
  private yMin: number;
  private yMax: number;
  constructor(xMin: number, xMax: number, yMin: number, yMax: number) {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
  }
  get left() {
    return this.xMin;
  }
  get top() {
    return this.yMax;
  }
  get right() {
    return this.xMax;
  }
  get bottom() {
    return this.yMin;
  }
  get width() {
    return this.xMax - this.xMin;
  }
  get height() {
    return this.yMin - this.yMax;
  }
  /**
   * Center X
   */
  get x() {
    return this.left + this.width / 2;
  }
  /**
   * Center Y
   */
  get y() {
    return this.top + this.height / 2;
  }
}

/**
 * Check if the entity is a valid subject for ESP
 * Does not check for entity.objInstances
 * That's up to the caller so they can get the type safety in an if() statement
 */
function canESP(entity: Player | AI) {
  const game = getGame();

  return (
    entityAlive(entity) &&
    (entity.isPlayer
      ? !entity.isYou && game.players.list.includes(entity)
      : game.AI.ais.includes(entity)) &&
    (!getExposedWindow().spectating || game.controls.spect.target !== entity)
  );
}

function playerAimbotHitbox(player: Player, hitbox: "head" | "chest" | "feet") {
  const config = getConfig();
  const game = getGame();

  if (hitbox === "head") {
    const vec = new game.THREE.Vector3();
    player.upperBody?.getWorldPosition(vec);
    return vec;
  }

  const hitboxOffset =
    hitbox === "feet" ? config.legHeight / 2 : config.playerHeight / 2;

  return new game.THREE.Vector3(
    player.x,
    player.y +
      player.height -
      hitboxOffset -
      player.crouchVal * config.crouchDst,
    player.z
  );
}

function getPotentialAimbotPoints(entity: Player | AI): THREE.Vector3[] {
  const game = getGame();
  const config = getConfig();

  if (entity.isPlayer) {
    const points: THREE.Vector3[] = [
      playerAimbotHitbox(entity, "head"),
      playerAimbotHitbox(entity, "chest"),
      playerAimbotHitbox(entity, "feet"),
    ];

    if (sketchConfig.get("multiPoint")) {
      const mpScale = sketchConfig.get("multiPointScale");
      const h = entity.height - entity.crouchVal * config.crouchDst;

      for (let x = -1; x <= 1; x += 1) {
        for (let z = -1; z <= 1; z += 1) {
          if (x === 0 && z === 0) continue;
          points.push(
            new game.THREE.Vector3(
              entity.x + x * mpScale,
              entity.y + h * 0.6,
              entity.z + z * mpScale
            )
          );
        }
      }
    }

    return points;
  }

  const aiMid = entity.y + entity.height * 0.5;
  const aiTop = entity.y + entity.height;
  const aiRadius = Math.max(entity.mSize * 0.45, 0.12);

  return [
    new game.THREE.Vector3(entity.x, aiTop, entity.z),
    new game.THREE.Vector3(entity.x, aiMid, entity.z),
    new game.THREE.Vector3(entity.x, entity.y, entity.z),
    new game.THREE.Vector3(entity.x + aiRadius, aiMid, entity.z),
    new game.THREE.Vector3(entity.x - aiRadius, aiMid, entity.z),
    new game.THREE.Vector3(entity.x, aiMid, entity.z + aiRadius),
    new game.THREE.Vector3(entity.x, aiMid, entity.z - aiRadius),
  ];
}

function playerBox(entity: Player | AI) {
  const config = getConfig();
  const render = getRender();

  if (entity.isPlayer) {
    const playerScale =
      (2 * config.armScale + config.chestWidth + config.armInset) / 2;
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;

    if (!entity.objInstances) return;

    for (let j = -1; j < 2; j += 2) {
      for (let k = -1; k < 2; k += 2) {
        for (let l = 0; l < 2; l++) {
          const position = entity.objInstances.position.clone();
          position.x += j * playerScale;
          position.z += k * playerScale;
          position.y +=
            l * (entity.height - entity.crouchVal * config.crouchDst);
          if (!render.frustum.containPoint(position)) return;
          position.project(render.camera);
          xMin = Math.min(xMin, position.x);
          xMax = Math.max(xMax, position.x);
          yMin = Math.min(yMin, position.y);
          yMax = Math.max(yMax, position.y);
        }
      }
    }

    xMin = (xMin + 1) / 2;
    xMax = (xMax + 1) / 2;

    yMin = (yMin + 1) / 2;
    yMax = (yMax + 1) / 2;

    yMin = -(yMin - 0.5) + 0.5;
    yMax = -(yMax - 0.5) + 0.5;

    const overlaySize = getOverlaySizeScaled();
    xMin *= overlaySize.width;
    xMax *= overlaySize.width;
    yMin *= overlaySize.height;
    yMax *= overlaySize.height;

    return new PlayerRectBounds(xMin, xMax, yMin, yMax);
  } else {
    const pos = playerPos(entity);
    if (!getRender().frustum.containPoint(pos)) return;

    const minHeight = pos2D(pos);
    const maxHeight = pos2D(pos, entity.height);
    const height = ~~(minHeight.y - maxHeight.y);
    const width = ~~(height * 0.6);

    return new PlayerRectBounds(
      minHeight.x - width / 2,
      minHeight.x + width / 2,
      maxHeight.y,
      minHeight.y
    );
  }
}

type MaterialType =
  | THREE.MeshBasicMaterial
  | THREE.LineBasicMaterial
  | THREE.Color;

interface Materials<T extends MaterialType> {
  enemy: T;
  enemyWall: T;
  team: T;
  teamWall: T;
}

function getEntityMaterial<T extends MaterialType>(
  entity: Player | AI,
  materials: Materials<T>
) {
  return isEnemy(entity)
    ? canISeeEnt(entity)
      ? materials.enemy
      : materials.enemyWall
    : canISeeEnt(entity)
      ? materials.team
      : materials.teamWall;
}

function initMaterials() {
  const game = getGame();

  const genericMesh = () =>
    new game.THREE.MeshBasicMaterial({
      transparent: true,
      fog: false,
      depthTest: false,
      depthWrite: false,
      stencilWrite: true,
      stencilFunc: game.THREE.NotEqualStencilFunc,
      stencilRef: CHAM_STENCIL_REF,
      stencilWriteMask: 0xff,
      stencilFuncMask: 0xff,
      stencilZPass: game.THREE.ReplaceStencilOp,
      stencilZFail: game.THREE.ReplaceStencilOp,
      stencilFail: game.THREE.ReplaceStencilOp,
    });

  const mesh: Materials<THREE.MeshBasicMaterial> = {
    enemy: genericMesh(),
    enemyWall: genericMesh(),
    team: genericMesh(),
    teamWall: genericMesh(),
  };

  const genericColor = () => new game.THREE.Color();

  const colors: Materials<THREE.Color> = {
    enemy: genericColor(),
    enemyWall: genericColor(),
    team: genericColor(),
    teamWall: genericColor(),
  };

  let lastBadColor = "";
  let lastGoodColor = "";
  let lastRainbowColor = "";
  let lastRainbowEnemy = false;
  let lastRainbowFriendly = false;
  let lastWallDarkness = -1;
  let lastChamsOpacity = -1;

  const materials = {
    mesh,
    colors,
    updated: false,
    update: () => {
      const badColor = sketchConfig.get("badColor");
      const goodColor = sketchConfig.get("goodColor");
      const rainbowEnemy = sketchConfig.get("espRainbowEnemy");
      const rainbowFriendly = sketchConfig.get("espRainbowFriendly");
      const rainbowColor = sharedRainbowHexColor;
      const wallDarkness = sketchConfig.get("espWallDarkness");
      const chamsOpacity = sketchConfig.get("chamsOpacity");

      if (
        badColor === lastBadColor &&
        goodColor === lastGoodColor &&
        rainbowEnemy === lastRainbowEnemy &&
        rainbowFriendly === lastRainbowFriendly &&
        rainbowColor === lastRainbowColor &&
        wallDarkness === lastWallDarkness &&
        chamsOpacity === lastChamsOpacity
      )
        return;

      lastBadColor = badColor;
      lastGoodColor = goodColor;
      lastRainbowEnemy = rainbowEnemy;
      lastRainbowFriendly = rainbowFriendly;
      lastRainbowColor = rainbowColor;
      lastWallDarkness = wallDarkness;
      lastChamsOpacity = chamsOpacity;

      materials.updated = true;

      const sharedHex = parseInt(rainbowColor.slice(1), 16);
      const enemyHex = rainbowEnemy ? sharedHex : parseInt(badColor.slice(1), 16);
      const teamHex = rainbowFriendly
        ? sharedHex
        : parseInt(goodColor.slice(1), 16);

      colors.enemy.set(enemyHex);
      colors.team.set(teamHex);

      colors.enemyWall.set(colors.enemy);
      colors.teamWall.set(colors.team);

      colors.enemyWall.multiplyScalar(wallDarkness);
      colors.teamWall.multiplyScalar(wallDarkness);

      mesh.enemy.color.set(colors.enemy);
      mesh.enemyWall.color.set(colors.enemyWall);
      mesh.team.color.set(colors.team);
      mesh.teamWall.color.set(colors.teamWall);

      mesh.enemy.opacity = chamsOpacity;
      mesh.enemyWall.opacity = chamsOpacity;
      mesh.team.opacity = chamsOpacity;
      mesh.teamWall.opacity = chamsOpacity;
    },
  };

  return materials;
}

let materials: ReturnType<typeof initMaterials> | undefined;

const getMaterials = () => {
  if (!materials) materials = initMaterials();
  // preserve the variable in this scope for nested functions
  return materials;
};

//@ts-ignore
//Object.assign(getExposedWindow(), { getMaterials });

const espMat = Symbol();
const hook = Symbol();
const CHAM_STENCIL_REF = 0x7f;
let lastChamStencilClearFrame = -1;

function getPropertyDescriptor(
  target: object,
  key: PropertyKey
): PropertyDescriptor | undefined {
  let current: object | null = target;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) return descriptor;
    current = Object.getPrototypeOf(current);
  }

  return undefined;
}

declare module "three" {
  interface Mesh {
    [hook]?: boolean;
  }

  interface Object3D {
    [hook]?: boolean;
  }
}

declare module "../krunker/Player" {
  interface Player {
    [espMat]?: THREE.Material;
  }
}

export function espHook() {
  overlayRenderHooks.push(() => {
    const overlay = getOverlay();
    const game = getGame();
    const materials = getMaterials();
    const render = getRender();

    materials.update();

    const chams = sketchConfig.get("chams");
    const showInMenu = sketchConfig.get("espMenu");

    for (const entity of game.players.list) {
      if (entity.objInstances) {
        const can = chams && (showInMenu || !isInMenus()) && canESP(entity);

        if (can) entity[espMat] = getEntityMaterial(entity, materials.mesh);
        else delete entity[espMat];

        if (!(hook in entity.objInstances)) {
          entity.objInstances[hook] = true;

          const visibleDescriptor = getPropertyDescriptor(
            entity.objInstances,
            "visible"
          );
          let fallbackVisible = entity.objInstances.visible;

          Object.defineProperty(entity.objInstances, "visible", {
            configurable: true,
            get: () => {
              // Menu player models can get stuck hidden if the cham visibility
              // lock competes with menu scene toggles. Preserve menu visibility.
              if (isInMenus()) {
                if (visibleDescriptor?.get)
                  return visibleDescriptor.get.call(entity.objInstances);
                return true;
              }

              if (espMat in entity) return true;
              if (visibleDescriptor?.get)
                return visibleDescriptor.get.call(entity.objInstances);
              return fallbackVisible;
            },
            set: (newVisible) => {
              if (visibleDescriptor?.set) {
                visibleDescriptor.set.call(entity.objInstances, newVisible);
              } else {
                fallbackVisible = newVisible;
              }
            },
          });
        }

        // Just manually select the meshes to hook
        // Much faster than calling traverse()
        for (const mesh of getPlayerMeshes(entity)) {
          if (typeof mesh !== "object" || mesh === null || hook in mesh)
            continue;

          mesh[hook] = true;

          const twin = mesh.clone(false);
          mesh.parent!.add(twin);
          twin[hook] = true;
          twin.renderOrder = 10000;

          twin.matrixAutoUpdate = false;
          twin.matrixWorldAutoUpdate = false;

          twin.onBeforeRender = (renderer) => {
            const frame = renderer.info.render.frame;
            if (frame === lastChamStencilClearFrame) return;

            // Reset stencil once per frame so cham fragments are written only once per pixel.
            renderer.clear(false, false, true);
            lastChamStencilClearFrame = frame;
          };

          Object.defineProperty(twin, "matrixWorld", {
            get: () => mesh.matrixWorld,
          });

          Object.defineProperty(twin, "matrix", {
            get: () => mesh.matrix,
          });

          Object.defineProperty(twin, "visible", {
            get: () => espMat in entity && mesh.visible,
          });

          Object.defineProperty(twin, "material", {
            get: () => entity[espMat],
          });
        }
      }
    }

    // closely related logic
    const boxes = sketchConfig.get("boxes");
    const healthBars = sketchConfig.get("healthBars");
    const newNametags = sketchConfig.get("newNametags");
    const tracersEnemy = sketchConfig.get("tracersEnemy");
    const tracersFriendly = sketchConfig.get("tracersFriendly");
    const tracerThickness = sketchConfig.get("tracerThickness");
    const spawnESP = sketchConfig.get("spawnESP");

    // const { globalAlpha } = overlay.ctx;
    const willRender =
      tracersEnemy || tracersFriendly || newNametags || boxes || healthBars || spawnESP;

    if (!willRender || isInMenus()) return;

    overlay.ctx.save();
    overlay.ctx.scale(overlay.scale, overlay.scale);

    const overlayOpacity = sketchConfig.get("overlayOpacity");

    const overlaySize = getOverlaySizeScaled();

    // --- Spawn point ESP ---
    if (spawnESP) {
      const spawns: SpawnPoint[] = (game.map as any).spawns;
      if (spawns && spawns.length) {
        const BEAM_HEIGHT = 200;
        const BEAM_WIDTH = 4;

        const cam = render.camera;
        const mvp = new game.THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        const sw = innerWidth / overlay.scale;
        const sh = innerHeight / overlay.scale;

        for (const spawn of spawns) {
          const bottom = new game.THREE.Vector4(spawn.x, spawn.y, spawn.z, 1).applyMatrix4(mvp);
          const top = new game.THREE.Vector4(spawn.x, spawn.y + BEAM_HEIGHT, spawn.z, 1).applyMatrix4(mvp);

          // Both behind near plane — skip
          if (bottom.w <= 0 && top.w <= 0) continue;

          // Clip to near plane if one point is behind the camera
          let bx: number, by: number, tx: number, ty: number;

          if (bottom.w <= 0) {
            // Lerp bottom toward top to the near plane (w=0.001)
            const t = (0.001 - bottom.w) / (top.w - bottom.w);
            const cw = bottom.w + t * (top.w - bottom.w);
            bx = ((bottom.x + t * (top.x - bottom.x)) / cw + 1) / 2 * sw;
            by = (-(bottom.y + t * (top.y - bottom.y)) / cw + 1) / 2 * sh;
          } else {
            bx = (bottom.x / bottom.w + 1) / 2 * sw;
            by = (-bottom.y / bottom.w + 1) / 2 * sh;
          }

          if (top.w <= 0) {
            const t = (0.001 - top.w) / (bottom.w - top.w);
            const cw = top.w + t * (bottom.w - top.w);
            tx = ((top.x + t * (bottom.x - top.x)) / cw + 1) / 2 * sw;
            ty = (-(top.y + t * (bottom.y - top.y)) / cw + 1) / 2 * sh;
          } else {
            tx = (top.x / top.w + 1) / 2 * sw;
            ty = (-top.y / top.w + 1) / 2 * sh;
          }

          // Color by team
          let color: string;
          if (spawn.team === 1) color = "#00ccff";
          else if (spawn.team === 2) color = "#ff4444";
          else color = "#ffffff";

          overlay.ctx.globalAlpha = overlayOpacity * 0.6;
          overlay.ctx.strokeStyle = color;
          overlay.ctx.lineWidth = BEAM_WIDTH;
          overlay.ctx.beginPath();
          overlay.ctx.moveTo(bx, by);
          overlay.ctx.lineTo(tx, ty);
          overlay.ctx.stroke();
          overlay.ctx.closePath();
          overlay.ctx.globalAlpha = 1;
        }
      }
    }

    const entities = game.AI.ais.length
      ? (game.players.list as (Player | AI)[]).concat(game.AI.ais)
      : game.players.list;

    const renderHitboxPoints = sketchConfig.get("renderHitboxPoints");

    for (const entity of entities) {
      const shouldTrackEntity = canESP(entity);

      if (renderHitboxPoints && shouldTrackEntity) {
        entity[hitboxPoints] = getPotentialAimbotPoints(entity);
      } else if (hitboxPoints in entity) {
        delete entity[hitboxPoints];
      }

      const entityColor =
        "#" + getEntityMaterial(entity, materials.colors).getHexString();
      const entityOutlineColor =
        "#" +
        getEntityMaterial(entity, materials.colors)
          .clone()
          .multiplyScalar(sketchConfig.get("espWallDarkness"))
          .getHexString();

      if (renderHitboxPoints && hitboxPoints in entity) {
        const pointSize = 20;
        const halfPointSize = pointSize / 2;
        overlay.ctx.globalAlpha = overlayOpacity;
        overlay.ctx.fillStyle = entityColor;
        for (const p of entity[hitboxPoints]!) {
          const pos = pos2D(p);
          overlay.ctx.fillRect(
            pos.x - halfPointSize,
            pos.y - halfPointSize,
            pointSize,
            pointSize
          );
        }
        overlay.ctx.globalAlpha = 1;
      }

      if (!shouldTrackEntity) continue;

      const drawTracer = isEnemy(entity) ? tracersEnemy : tracersFriendly;
      if (drawTracer) {
        let tracerPoint: THREE.Vector2;
        const bottom = playerPos(entity);

        if (render.frustum.containPoint(bottom)) {
          tracerPoint = pos2D(bottom);
        } else {
          const dir = getOffScreenDir(render.camera, bottom);
          // console.log(dir);
          tracerPoint = new game.THREE.Vector2(
            0.5 + Math.cos(dir),
            0.5 - Math.sin(dir)
          );
          tracerPoint.x *= innerWidth / overlay.scale;
          tracerPoint.y *= innerHeight / overlay.scale;
        }

        overlay.ctx.strokeStyle = entityColor;
        overlay.ctx.lineWidth = tracerThickness;

        overlay.ctx.globalAlpha = overlayOpacity;
        overlay.ctx.beginPath();
        overlay.ctx.moveTo(overlaySize.width / 2, overlaySize.height / 2);
        overlay.ctx.lineTo(tracerPoint.x, tracerPoint.y);
        overlay.ctx.stroke();
        overlay.ctx.closePath();
        overlay.ctx.globalAlpha = 1;
      }

      const box = playerBox(entity);

      if (!box) continue;

      if (newNametags) {
        overlay.ctx.fillStyle = "#000"; // Set fill style to black for the square
        overlay.ctx.lineWidth = 4;
        overlay.ctx.imageSmoothingEnabled = false;

        overlay.ctx.globalAlpha = 0.9;

        // Calculate text dimensions
        overlay.ctx.font = "16px monospace"; // Make sure the font is set before measuring
        const text = entity.name;
        const textMetrics = overlay.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 16; // The font size is 16px

        const tx = box.left + box.width / 2;
        const ty = box.top - 20;

        // Draw the black square behind the text
        overlay.ctx.fillRect(
          tx - textWidth / 2 - 5,
          ty - 2,
          textWidth + 10,
          textHeight + 4
        ); // Adjust padding as necessary

        // Set fill style back to white for the text
        overlay.ctx.fillStyle = "#fff";

        // Draw the text on top of the black square
        overlay.ctx.textAlign = "center";
        overlay.ctx.textBaseline = "top";
        overlay.ctx.fillText(text, tx, ty);
      }

      if (boxes) {
        overlay.ctx.globalAlpha = overlayOpacity;

        // Draw a darker outer stroke first so box outlines follow wall-darkness tuning.
        overlay.ctx.strokeStyle = entityOutlineColor;
        overlay.ctx.lineWidth = 3;
        overlay.ctx.strokeRect(box.left, box.top, box.width, box.height);

        overlay.ctx.strokeStyle = entityColor;
        overlay.ctx.lineWidth = 1.5;
        overlay.ctx.strokeRect(box.left, box.top, box.width, box.height);
        overlay.ctx.globalAlpha = 1;
      }

      if (healthBars) {
        const barMargin = box.width * 0.05;
        const barWidth = box.width * 0.1;
        overlay.ctx.globalAlpha = overlayOpacity;
        overlay.ctx.fillStyle = "#F00";
        overlay.ctx.fillRect(
          box.right + barMargin,
          box.top,
          barWidth,
          box.height
        );

        overlay.ctx.fillStyle = "#0F0";
        const remaining = box.height * (entity.health / entity.maxHealth);
        overlay.ctx.fillRect(
          box.right + barMargin,
          box.top + (box.height - remaining),
          barWidth,
          remaining
        );
        overlay.ctx.globalAlpha = 1;
      }
    }

    overlay.ctx.restore();
  });
}

export function ESPMenu() {
  const [nametags, setNametags] = useSketchConfig("nametags");
  const [boxes, setBoxes] = useSketchConfig("boxes");
  const [chams, setChams] = useSketchConfig("chams");
  // make it also apply to all the other esp crap
  const [overlayOpacity, setOverlayOpacity] = useSketchConfig("overlayOpacity");
  const [chamsOpacity, setChamsOpacity] = useSketchConfig("chamsOpacity");
  const [tracersEnemy, setTracersEnemy] = useSketchConfig("tracersEnemy");
  const [tracersFriendly, setTracersFriendly] = useSketchConfig("tracersFriendly");
  const [tracerThickness, setTracerThickness] = useSketchConfig("tracerThickness");
  const [healthBars, setHealthBars] = useSketchConfig("healthBars");
  const [spawnESP, setSpawnESP] = useSketchConfig("spawnESP");
  const [badColor, setBadColor] = useSketchConfig("badColor");
  const [goodColor, setGoodColor] = useSketchConfig("goodColor");
  const [espRainbowEnemy, setEspRainbowEnemy] = useSketchConfig("espRainbowEnemy");
  const [espRainbowFriendly, setEspRainbowFriendly] = useSketchConfig(
    "espRainbowFriendly",
  );
  const [newNametags, setNewNametags] = useSketchConfig("newNametags");
  const [espMenu, setEspMenu] = useSketchConfig("espMenu");
  const [espWallDarkness, setEspWallDarkness] = useSketchConfig("espWallDarkness");
  const [renderHitboxPoints, setRenderHitboxPoints] = useSketchConfig("renderHitboxPoints");

  return (
    <>
      <Switch
        title="Show ESP in menus"
        defaultChecked={espMenu}
        onChange={(event) => setEspMenu(event.currentTarget.checked)}
      />
      <Switch
        title="Nametags"
        description="Shows player nametags through walls"
        defaultChecked={nametags}
        onChange={(event) => setNametags(event.currentTarget.checked)}
      />
      <Switch
        title="New Nametags"
        description="lets you use sketch's nametags"
        defaultChecked={newNametags}
        onChange={(event) => setNewNametags(event.currentTarget.checked)}
      />
      <Switch
        title="Render Hitbox Points"
        description="Draws 20x20 boxes at cached potential aimbot points"
        defaultChecked={renderHitboxPoints}
        onChange={(event) => setRenderHitboxPoints(event.currentTarget.checked)}
      />
      <Switch
        title="Chams"
        description="Makes players a bright color and visible through walls"
        defaultChecked={chams}
        onChange={(event) => setChams(event.currentTarget.checked)}
      />
      <Slider
        title="Chams Opacity"
        defaultValue={chamsOpacity}
        onChange={(event) => setChamsOpacity(event.currentTarget.valueAsNumber)}
        min={0}
        max={1}
        step={0.05}
      />
      <Switch
        title="Boxes"
        description="Displays a box around players"
        defaultChecked={boxes}
        onChange={(event) => setBoxes(event.currentTarget.checked)}
      />
      <Switch
        title="Enemy Tracers"
        description="Draws a line to enemy players"
        defaultChecked={tracersEnemy}
        onChange={(event) => setTracersEnemy(event.currentTarget.checked)}
      />
      <Switch
        title="Friendly Tracers"
        description="Draws a line to friendly players"
        defaultChecked={tracersFriendly}
        onChange={(event) => setTracersFriendly(event.currentTarget.checked)}
      />
      <Slider
        title="Tracer Thickness"
        description="Line width for tracer ESP"
        defaultValue={tracerThickness}
        onChange={(event) =>
          setTracerThickness(event.currentTarget.valueAsNumber)
        }
        min={0.5}
        max={6}
        step={0.1}
      />
      <Switch
        title="Health Bars"
        description="Shows a health bar next to a player"
        defaultChecked={healthBars}
        onChange={(event) => setHealthBars(event.currentTarget.checked)}
      />
      <Switch
        title="Spawn Points"
        description="Draws beams at spawn locations (white=neutral, cyan=team1, red=team2)"
        defaultChecked={spawnESP}
        onChange={(event) => setSpawnESP(event.currentTarget.checked)}
      />
      <Slider
        title="Overlay Opacity"
        description="tracer lines & box esp"
        defaultValue={overlayOpacity}
        onChange={(event) =>
          setOverlayOpacity(event.currentTarget.valueAsNumber)
        }
        min={0}
        max={1}
        step={0.05}
      />
      <Slider
        title="Wall Color Darkness"
        description="0 = black, 1 = no darkening"
        defaultValue={espWallDarkness}
        onChange={(event) =>
          setEspWallDarkness(event.currentTarget.valueAsNumber)
        }
        min={0}
        max={1}
        step={0.05}
      />
      <Switch
        title="Gaybow Enemy Colors 🌈"
        description="Uses badge spoof rainbow color for hostile ESP colors"
        defaultChecked={espRainbowEnemy}
        onChange={(event) => setEspRainbowEnemy(event.currentTarget.checked)}
      />
      <Switch
        title="Gaybow Friendly Colors 🌈"
        description="Uses badge spoof rainbow color for friendly ESP colors"
        defaultChecked={espRainbowFriendly}
        onChange={(event) => setEspRainbowFriendly(event.currentTarget.checked)}
      />
      <ColorPicker
        title="Hostile player color"
        description="Changes the ESP color"
        defaultValue={badColor}
        onChange={(event) => setBadColor(event.currentTarget.value)}
      />
      <ColorPicker
        title="Friendly player color"
        description="Changes the ESP color"
        defaultValue={goodColor}
        onChange={(event) => setGoodColor(event.currentTarget.value)}
      />
    </>
  );
}
