import { ColorPicker } from "../krunker-ui/components/ColorPicker";
import { getExposedWindow } from "../consts";
import {
  getConfig,
  getGame,
  getOverlay,
  getRender,
  overlayRenderHooks,
  patches,
  data,
  dataArg,
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
import { console } from "../crashout";

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
    if (!getRender().frustum.containPoint(playerPos(entity))) return;

    const minHeight = pos2D(playerPos(entity));
    const maxHeight = pos2D(playerPos(entity), entity.height);
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
    ? entity.canBSeen
      ? materials.enemy
      : materials.enemyWall
    : entity.canBSeen
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

  const materials = {
    mesh,
    colors,
    updated: false,
    update: () => {
      materials.updated = true;

      const enemyHex = parseInt(sketchConfig.get("badColor").slice(1), 16);
      const teamHex = parseInt(sketchConfig.get("goodColor").slice(1), 16);

      colors.enemy.set(enemyHex);
      colors.team.set(teamHex);

      colors.enemyWall.set(colors.enemy);
      colors.teamWall.set(colors.team);

      colors.enemyWall.addScalar(-0.3);
      colors.teamWall.addScalar(-0.3);

      mesh.enemy.color.set(colors.enemy);
      mesh.enemyWall.color.set(colors.enemyWall);
      mesh.team.color.set(colors.team);
      mesh.teamWall.color.set(colors.teamWall);

      const espOpacity = sketchConfig.get("espOpacity");
      mesh.enemy.opacity = espOpacity;
      mesh.enemyWall.opacity = espOpacity;
      mesh.team.opacity = espOpacity;
      mesh.teamWall.opacity = espOpacity;
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
  patches.Nametags = [
    /!(\w+)\.isYou&&\1\.objInstances\){if\(\1\.canBSeen\){/,
    (match, player) =>
      `!${player}.isYou&&${player}.objInstances){if(!${dataArg}.newNames&&(${player}.canBSeen||${dataArg}.nametags)){`,
  ];

  Object.defineProperty(data, "nametags", {
    get: () => sketchConfig.get("nametags"),
  });

  Object.defineProperty(data, "newNames", {
    get: () => sketchConfig.get("newNametags"),
  });

  overlayRenderHooks.push(() => {
    const overlay = getOverlay();
    const game = getGame();
    const materials = getMaterials();
    const render = getRender();

    materials.update();

    const chams = sketchConfig.get("chams");

    if (chams)
      for (const entity of game.players.list) {
        if (entity.objInstances) {
          const can =
            sketchConfig.get("chams") && !isInMenus() && canESP(entity);

          if (can) entity[espMat] = getEntityMaterial(entity, materials.mesh);
          else delete entity[espMat];

          if (!(hook in entity.objInstances)) {
            entity.objInstances[hook] = true;

            let { visible } = entity.objInstances;

            Object.defineProperty(entity.objInstances, "visible", {
              get: () => espMat in entity || visible,
              set: (newVisible) => (visible = newVisible),
            });
          }

          // Just manually select the meshes to hook
          // Much faster than calling traverse()
          for (const mesh of getPlayerMeshes(entity)) {
            if (hook in mesh) continue;
            mesh[hook] = true;

            const twin = mesh.clone(false);
            mesh.parent!.add(twin);
            twin[hook] = true;

            Object.defineProperty(twin, "position", {
              get: () => mesh.position,
            });

            twin.matrixAutoUpdate = false;
            twin.matrixWorldAutoUpdate = false;

            Object.defineProperty(twin, "matrixWorld", {
              get: () => mesh.matrixWorld,
            });

            Object.defineProperty(twin, "matrixWorldNeedsUpdate", {
              get: () => mesh.matrixWorldNeedsUpdate,
            });

            Object.defineProperty(twin, "rotation", {
              get: () => mesh.rotation,
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

    const espOpacity = sketchConfig.get("espOpacity");

    overlay.ctx.scale(overlay.scale, overlay.scale);

    for (const entity of [...game.players.list, ...game.AI.ais]) {
      if (!canESP(entity)) continue;

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

        overlay.ctx.strokeStyle =
          "#" + getEntityMaterial(entity, materials.colors).getHexString();
        overlay.ctx.lineWidth = 1.5;

        overlay.ctx.globalAlpha = espOpacity;
        overlay.ctx.beginPath();
        const overlaySize = getOverlaySizeScaled();
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
        overlay.ctx.globalAlpha = espOpacity;
        overlay.ctx.strokeStyle =
          "#" + getEntityMaterial(entity, materials.colors).getHexString();
        overlay.ctx.lineWidth = 1.5;
        overlay.ctx.strokeRect(box.left, box.top, box.width, box.height);
        overlay.ctx.globalAlpha = 1;
      }

      if (healthBars) {
        const barMargin = box.width * 0.05;
        const barWidth = box.width * 0.1;
        overlay.ctx.globalAlpha = espOpacity;
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
  const [espOpacity, setEspOpacity] = useSketchConfig("espOpacity");
  const [tracers, setTracers] = useSketchConfig("tracers");
  const [healthBars, setHealthBars] = useSketchConfig("healthBars");
  const [badColor, setBadColor] = useSketchConfig("badColor");
  const [goodColor, setGoodColor] = useSketchConfig("goodColor");
  const [newNametags, setNewNametags] = useSketchConfig("newNametags");

  return (
    <>
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
        title="ESP Opacity"
        defaultValue={espOpacity}
        onChange={(event) => setEspOpacity(event.currentTarget.valueAsNumber)}
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
      <Switch
        title="Health Bars"
        description="Shows a health bar next to a player"
        defaultChecked={healthBars}
        onChange={(event) => setHealthBars(event.currentTarget.checked)}
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
