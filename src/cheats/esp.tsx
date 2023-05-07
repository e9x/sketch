import {
  getConfig,
  getGame,
  getOverlay,
  getRender,
  renderHooks,
} from "../filters";
import type { AI } from "../krunker/AI";
import type { Player } from "../krunker/Player";
import {
  entityAlive,
  isEnemy,
  isInMenus,
  playerPos,
  pos2D,
} from "../krunkerUtil";
import Switch from "../menu/components/Switch";
import sketchConfig, { useSketchConfig } from "../sketchConfig";

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

function playerBox(entity: Player | AI) {
  const config = getConfig();
  const overlay = getOverlay();
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

    const scaledWidth = overlay.canvas.width / overlay.scale;
    const scaledHeight = overlay.canvas.height / overlay.scale;

    xMin *= scaledWidth;
    xMax *= scaledWidth;
    yMin *= scaledHeight;
    yMax *= scaledHeight;

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

export const enemyColor = "#eb5656";
export const friendlyColor = "#9eeb56";

export function espHook() {
  let enemyMaterial: THREE.MeshBasicMaterial | undefined;
  let friendlyMaterial: THREE.MeshBasicMaterial | undefined;
  const hookedMeshes = new WeakSet<THREE.Mesh>();
  const hookedObjects = new WeakSet<THREE.Object3D>();

  renderHooks.push(() => {
    const overlay = getOverlay();
    const game = getGame();

    if (sketchConfig.get("chams")) {
      if (!enemyMaterial)
        enemyMaterial = new game.THREE.MeshBasicMaterial({
          transparent: true,
          fog: false,
          depthTest: false,
          color: enemyColor,
        });

      if (!friendlyMaterial)
        friendlyMaterial = new game.THREE.MeshBasicMaterial({
          transparent: true,
          fog: false,
          depthTest: false,
          color: friendlyColor,
        });

      for (const entity of game.players.list) {
        if (entity.isPlayer && !entity.isYou && entity.objInstances) {
          if (!hookedObjects.has(entity.objInstances)) {
            hookedObjects.add(entity.objInstances);

            let { visible } = entity.objInstances;

            Object.defineProperty(entity.objInstances, "visible", {
              get: () => (sketchConfig.get("chams") ? true : visible),
              set: (newVisible) => {
                visible = newVisible;
              },
            });
          }

          entity.objInstances.traverse((e) => {
            if (!(e instanceof game.THREE.Mesh) || hookedMeshes.has(e)) return;
            hookedMeshes.add(e);

            let { material } = e;

            Object.defineProperty(e, "material", {
              get: () =>
                sketchConfig.get("chams")
                  ? isEnemy(entity)
                    ? enemyMaterial
                    : friendlyMaterial
                  : material,
              set: (newMaterial) => {
                material = newMaterial;
              },
            });
          });
        }
      }
    }

    if (sketchConfig.get("boxes") && !isInMenus()) {
      overlay.ctx.save();
      overlay.ctx.save();
      overlay.ctx.scale(overlay.scale, overlay.scale);

      for (const entity of [...game.players.list, ...game.AI.ais]) {
        if (!entityAlive(entity)) continue;

        const box = playerBox(entity);

        if (!box) continue;

        const enemy = isEnemy(entity);

        overlay.ctx.strokeStyle = enemy ? enemyColor : friendlyColor;
        overlay.ctx.lineWidth = 1.5;
        overlay.ctx.strokeRect(box.left, box.top, box.width, box.height);
      }

      overlay.ctx.restore();
    }
  });
}

export function ESPMenu() {
  const [nametags, setNametags] = useSketchConfig("nametags");
  const [boxes, setBoxes] = useSketchConfig("boxes");
  const [chams, setChams] = useSketchConfig("chams");

  return (
    <>
      <Switch
        title="Nametags"
        description="Shows player nametags through walls"
        defaultChecked={nametags}
        onChange={(event) => setNametags(event.currentTarget.checked)}
      />
      <Switch
        title="Chams"
        description="Makes players a bright color and visible through walls"
        defaultChecked={chams}
        onChange={(event) => setChams(event.currentTarget.checked)}
      />
      <Switch
        title="Boxes"
        description="Displays a box around players"
        defaultChecked={boxes}
        onChange={(event) => setBoxes(event.currentTarget.checked)}
      />
    </>
  );
}
