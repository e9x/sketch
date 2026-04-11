import { ColorPicker } from "../krunker-ui/components/ColorPicker";
import { getExposedWindow } from "../consts";
import {
  getConfig,
  getGame,
  getOverlay,
  getRender,
  overlayRenderHooks,
  canISeeEnt,
} from "../filters";
import type { AI } from "../krunker/AI";
import type { Player } from "../krunker/Player";
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
import { sharedRainbowHexColor } from "./badgeSpoof";

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
    const tracers = sketchConfig.get("tracers");
    const tracerThickness = sketchConfig.get("tracerThickness");

    // const { globalAlpha } = overlay.ctx;
    const willRender = tracers || newNametags || boxes || healthBars;

    if (!willRender || isInMenus()) return;

    // initial values
    const ogTrans = overlay.ctx.getTransform();

    const {
      globalAlpha,
      strokeStyle,
      lineWidth,
      fillStyle,
      textAlign,
      textBaseline,
      imageSmoothingEnabled,
      font,
    } = overlay.ctx;

    const overlayOpacity = sketchConfig.get("overlayOpacity");

    overlay.ctx.scale(overlay.scale, overlay.scale);

    const overlaySize = getOverlaySizeScaled();

    const entities = game.AI.ais.length
      ? (game.players.list as (Player | AI)[]).concat(game.AI.ais)
      : game.players.list;

    for (const entity of entities) {
      if (!canESP(entity)) continue;

      const entityColor =
        "#" + getEntityMaterial(entity, materials.colors).getHexString();
      const entityOutlineColor =
        "#" +
        getEntityMaterial(entity, materials.colors)
          .clone()
          .multiplyScalar(sketchConfig.get("espWallDarkness"))
          .getHexString();

      if (tracers) {
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

    overlay.ctx.setTransform(ogTrans);
    Object.assign(overlay.ctx, {
      globalAlpha,
      strokeStyle,
      lineWidth,
      fillStyle,
      textAlign,
      textBaseline,
      imageSmoothingEnabled,
      font,
    });
  });
}

export function ESPMenu() {
  const [nametags, setNametags] = useSketchConfig("nametags");
  const [boxes, setBoxes] = useSketchConfig("boxes");
  const [chams, setChams] = useSketchConfig("chams");
  // make it also apply to all the other esp crap
  const [overlayOpacity, setOverlayOpacity] = useSketchConfig("overlayOpacity");
  const [chamsOpacity, setChamsOpacity] = useSketchConfig("chamsOpacity");
  const [tracers, setTracers] = useSketchConfig("tracers");
  const [tracerThickness, setTracerThickness] = useSketchConfig("tracerThickness");
  const [healthBars, setHealthBars] = useSketchConfig("healthBars");
  const [badColor, setBadColor] = useSketchConfig("badColor");
  const [goodColor, setGoodColor] = useSketchConfig("goodColor");
  const [espRainbowEnemy, setEspRainbowEnemy] = useSketchConfig("espRainbowEnemy");
  const [espRainbowFriendly, setEspRainbowFriendly] = useSketchConfig(
    "espRainbowFriendly",
  );
  const [newNametags, setNewNametags] = useSketchConfig("newNametags");
  const [espMenu, setEspMenu] = useSketchConfig("espMenu");
  const [espWallDarkness, setEspWallDarkness] = useSketchConfig("espWallDarkness");

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
        title="Tracers"
        description="Draws a line between your camera and other players"
        defaultChecked={tracers}
        onChange={(event) => setTracers(event.currentTarget.checked)}
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
