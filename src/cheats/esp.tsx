import {
  getConfig,
  getGame,
  getOverlay,
  getRender,
  preRenderHooks,
  overlayRenderHooks,
} from "../filters";
import type { AI } from "../krunker/AI";
import type { Player } from "../krunker/Player";
import {
  entityAlive,
  getOverlaySizeScaled,
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

function isMesh(e: THREE.Object3D): e is THREE.Mesh {
  return e.type === "Mesh";
}

function initMaterials() {
  const game = getGame();
  // const render = getRender();
  const overlay = getOverlay();

  const enemyMaterial = new game.THREE.MeshBasicMaterial({
    transparent: true,
    fog: false,
    depthTest: false,
    color: overlay.healthColE,
  });

  const friendlyMaterial = new game.THREE.MeshBasicMaterial({
    transparent: true,
    fog: false,
    depthTest: false,
    color: overlay.healthColT,
  });

  const enemyTracerMaterial = new game.THREE.LineBasicMaterial({
    transparent: true,
    fog: false,
    color: overlay.healthColE,
    depthTest: false,
  });

  const friendlyTracerMaterial = new game.THREE.LineBasicMaterial({
    transparent: true,
    fog: false,
    color: overlay.healthColT,
    depthTest: false,
  });

  return {
    enemyMaterial,
    friendlyMaterial,
    enemyTracerMaterial,
    friendlyTracerMaterial,
    update: () => {
      enemyMaterial.color.set(overlay.healthColE);
      friendlyMaterial.color.set(overlay.healthColT);
      enemyTracerMaterial.color.set(overlay.healthColE);
      friendlyTracerMaterial.color.set(overlay.healthColT);
    },
  };
}

export function espHook() {
  let materials: ReturnType<typeof initMaterials> | undefined;
  const hookedMeshes = new WeakSet<THREE.Mesh>();
  const hookedObjects = new WeakSet<THREE.Object3D>();

  const getMaterials = () => {
    if (!materials) materials = initMaterials();
    // preserve the variable in this scope for nested functions
    return materials;
  };

  const generateLine = () => {
    const game = getGame();
    const render = getRender();
    const materials = getMaterials();

    const points = 2;

    // geometry
    const geometry = new game.THREE.BufferGeometry();

    // attributes
    const positions = new Float32Array(points * 3); // 3 vertices per point
    const buffer = new game.THREE.BufferAttribute(positions, 3);
    geometry.setAttribute("position", buffer);

    // drawcalls
    geometry.setDrawRange(0, points);

    // line
    const line = new game.THREE.Line(
      geometry,
      materials.friendlyTracerMaterial
    );

    render.scene.add(line);

    line.frustumCulled = false;

    return { line, buffer };
  };

  const lineMap = new Map<Player, ReturnType<typeof generateLine>>();

  preRenderHooks.push(() => {
    const game = getGame();
    const render = getRender();
    const materials = getMaterials();

    materials.update();

    // tracers
    // overlay.ctx.save();
    for (const [entity, data] of lineMap) {
      if (
        !sketchConfig.get("tracers") ||
        !entityAlive(entity) ||
        !game.players.list.includes(entity) ||
        !entity.objInstances
      ) {
        render.scene.remove(data.line);
        lineMap.delete(entity);
      }
    }

    if (sketchConfig.get("tracers"))
      for (const entity of game.players.list) {
        if (entity.isPlayer && !entity.isYou && entity.objInstances) {
          if (!entityAlive(entity)) continue;

          if (!lineMap.has(entity)) lineMap.set(entity, generateLine());

          const { line, buffer } = lineMap.get(entity)!;

          const direction = new render.THREE.Vector3();
          const position = game.controls.object.position;

          render.camera.getWorldDirection(direction);

          const eP = entity.objInstances.position;

          // Move the starting point slightly forward from the camera's position
          const startPoint = position.clone().add(direction);

          line.material = isEnemy(entity)
            ? materials.enemyTracerMaterial
            : materials.friendlyTracerMaterial;

          buffer.setXYZ(0, startPoint.x, startPoint.y, startPoint.z);
          buffer.setXYZ(1, eP.x, eP.y, eP.z);
          buffer.needsUpdate = true;
        }
      }
  });

  overlayRenderHooks.push(() => {
    const overlay = getOverlay();
    const game = getGame();
    const materials = getMaterials();

    materials.update();

    if (sketchConfig.get("chams")) {
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

          const doMesh = (e: THREE.Mesh) => {
            if (hookedMeshes.has(e)) return;
            hookedMeshes.add(e);

            let { material } = e;

            Object.defineProperty(e, "material", {
              get: () =>
                sketchConfig.get("chams")
                  ? isEnemy(entity)
                    ? materials.enemyMaterial
                    : materials.friendlyMaterial
                  : material,
              set: (newMaterial) => {
                material = newMaterial;
              },
            });
          };

          // Just manually select the meshes to hook
          // Much faster than calling traverse()
          for (const mesh of entity.legMeshes) doMesh(mesh);
          for (const mesh of entity.mergedArmMeshes) doMesh(mesh);
          for (const e of entity.weaponMeshes)
            for (const mesh of e.children) doMesh(mesh);
          if (entity.headObj) doMesh(entity.headObj);
          if (entity.lowerBody)
            for (const e of entity.lowerBody.children)
              if (e.name === "body" && isMesh(e)) doMesh(e);
          if (entity.bodyMesh)
            for (const mesh of entity.bodyMesh.children) doMesh(mesh);
        }
      }
    }

    if (sketchConfig.get("boxes") && !isInMenus()) {
      overlay.ctx.save();
      overlay.ctx.scale(overlay.scale, overlay.scale);

      for (const entity of [...game.players.list, ...game.AI.ais]) {
        if (!entityAlive(entity)) continue;

        const box = playerBox(entity);

        if (!box) continue;

        overlay.ctx.strokeStyle = isEnemy(entity)
          ? overlay.healthColE
          : overlay.healthColT;
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
  const [tracers, setTracers] = useSketchConfig("tracers");

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
      <Switch
        title="Tracers"
        description="Draws a line between your camera and other players"
        defaultChecked={tracers}
        onChange={(event) => setTracers(event.currentTarget.checked)}
      />
    </>
  );
}
