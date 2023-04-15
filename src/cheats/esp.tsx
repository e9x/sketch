import { getOverlay, renderHooks } from "../filters";

export function espHook() {
  renderHooks.push(() => {
    const overlay = getOverlay();

    overlay.ctx.textAlign = "center";
    overlay.ctx.fillText("hi", 200, 200);
  });
}

export function ESPMenu() {
  return <></>;
}
