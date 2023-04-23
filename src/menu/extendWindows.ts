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
  options: Omit<Omit<GameWindow, "gen">, "html">,
  render: RenderOnDemand
) {
  const html = createRenderContainer(render);

  const window = {
    ...options,
    gen: () => html,
    html: "",
  } as GameWindow;

  const id = windows.length;

  windows.push(window);

  return id + 1;
}
