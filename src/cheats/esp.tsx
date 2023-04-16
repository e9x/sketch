import {
  getConfig,
  getGame,
  getOverlay,
  getRender,
  renderHooks,
} from "../filters";
import type { Player } from "../krunker/Player";
import { isEnemy } from "../krunkerUtil";

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

  for (let x = -1; x < 2; x += 2) {
    for (let y = -1; y < 2; y += 2) {
      for (let z = 0; z < 2; z++) {
        position = player.objInstances.position.clone();
        position.x += x * playerScale;
        position.z += y * playerScale;
        position.y += z * player.height;
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
    try {
      const overlay = getOverlay();
      const game = getGame();

      for (const player of game.players.list) {
        const box = playerBox(player);

        if (!box) continue;

        const enemy = isEnemy(player);

        overlay.ctx.strokeStyle = enemy ? "#eb5656" : "#9eeb56";
        overlay.ctx.lineWidth = 1.5;
        overlay.ctx.strokeRect(box.left, box.top, box.width, box.height);
      }

      overlay.ctx.textAlign = "center";
      overlay.ctx.fillText("hi", 200, 200);
    } catch {
      // sometimes we're a little early
    }
  });
}

export function ESPMenu() {
  return <></>;
}
