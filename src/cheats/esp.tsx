import useConfig, { configGet } from "../config";
import {
  getConfig,
  getGame,
  getOverlay,
  getRender,
  renderHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import { isEnemy, isInMenus } from "../krunkerUtil";
import Switch from "../menu/components/Switch";

export const defaultESP = false;

export function forceNametags() {
  return configGet("esp");
}

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

function playerBox(player: Player) {
  const config = getConfig();
  const overlay = getOverlay();
  const render = getRender();

  const playerScale =
    (2 * config.armScale + config.chestWidth + config.armInset) / 2;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  let position = null;

  if (!player.objInstances) return;

  for (let j = -1; j < 2; j += 2) {
    for (let k = -1; k < 2; k += 2) {
      for (let l = 0; l < 2; l++) {
        position = player.objInstances.position.clone();
        position.x += j * playerScale;
        position.z += k * playerScale;
        position.y += l * (player.height - player.crouchVal * config.crouchDst);
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

  xMin *= overlay.canvas.width;
  xMax *= overlay.canvas.width;
  yMin *= overlay.canvas.height;
  yMax *= overlay.canvas.height;

  return new PlayerRectBounds(xMin, xMax, yMin, yMax);
}

export function espHook() {
  renderHooks.push(() => {
    if (!configGet("esp")) return;
    if (isInMenus()) return;

    try {
      const overlay = getOverlay();
      const game = getGame();

      overlay.ctx.save();

      for (const player of game.players.list) {
        const box = playerBox(player);

        if (!box) continue;

        const enemy = isEnemy(player);

        overlay.ctx.strokeStyle = enemy ? "#eb5656" : "#9eeb56";
        overlay.ctx.lineWidth = 1.5;
        overlay.ctx.strokeRect(box.left, box.top, box.width, box.height);
      }

      overlay.ctx.restore();
    } catch {
      // sometimes we're a little early
    }
  });
}

export function ESPMenu() {
  const [esp, setESP] = useConfig("esp");

  return (
    <Switch
      title="ESP"
      defaultChecked={esp}
      onChange={(event) => setESP(event.currentTarget.checked)}
    />
  );
}
