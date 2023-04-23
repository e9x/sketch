/**
 * createRoot
 */
import type { RenderOnDemand } from "./renderContainer";
import createRenderContainer from "./renderContainer";

/**
 * Create a native react window.
 *
 * @returns Newly created window ID.
 */
export default function extendWindows(
  options: GameWindow,
  render: RenderOnDemand
) {
  const html = createRenderContainer(render);

  const window: GameWindowRender = {
    ...options,
    gen: () => html,
  };

  const id = windows.length;

  windows.push(window);

  return id + 1;
}
