import { keyListeners } from "../keys";
import sketchConfig from "../sketchConfig";
import Menu from "./Menu";
import { createRenderContainer } from "../krunker-ui/container";

function sketchWindow() {
  const html = createRenderContainer(() => <Menu />);

  const win: GameWindowRender = {
    header: "✏️",
    label: "sketch",
    width: 1100,
    height: "100%",
    popup: true,
    sticky: true,
    forceScroll: true,
    gen: () => html,
  };

  // abuse of windows
  const old0 = windows[0];
  windows[0] = win;
  try {
    showWindow(1);
  } catch (err) {
    console.error("show win", err);
  }
  windows[0] = old0;
}

let sketchMenuButton: HTMLDivElement | undefined;

/**
 * updates the visibility of the menu button
 */
export function updateSketchMenuButton() {
  if (!sketchMenuButton) return;

  sketchMenuButton.style.display = sketchConfig.get("menuButton") ? "" : "none";
}

let created = false;
function createSketchMenuItem(menuItemContainer: HTMLDivElement) {
  if (created) return;
  created = true;
  const item = document.createElement("div");
  item.className = "menuItem svelte-fgmdj8";
  item.addEventListener("mouseenter", () => playTick());
  item.addEventListener("click", () => playSelect());
  const tool = item.attachShadow({ mode: "closed" });
  tool.innerHTML = `<link rel="stylesheet" href="https://krunker.io/css/material-icons-outlined.css?build=zVvup"><!----><span class="material-icons-outlined menuItemIcon svelte-fgmdj8" style="color: #fbff00">edit</span><!----> <div class="menuItemTitle svelte-fgmdj8">Sketch<!----><!----></div>`;
  // item.innerHTML = `<!----><span class="material-icons-outlined menuItemIcon svelte-fgmdj8" style="color: #fbff00">edit</span><!----> <div class="menuItemTitle svelte-fgmdj8" id="sketchMenu">Sketch<!----><!----></div>`;
  menuItemContainer.appendChild(item);

  sketchMenuButton = item;
  sketchMenuButton.addEventListener("click", sketchWindow);
  updateSketchMenuButton();
}

export function sketchButton() {
  const existing = document.querySelector<HTMLDivElement>("#menuItemContainer");
  if (existing) createSketchMenuItem(existing);

  const observer = new MutationObserver(() => {
    const menuItemContainer =
      document.querySelector<HTMLDivElement>("#menuItemContainer");
    if (menuItemContainer) createSketchMenuItem(menuItemContainer);
  });
  observer.observe(document, { childList: true, subtree: true });

  keyListeners.push((event, code, down) => {
    const menuKey = sketchConfig.get("menuKey");

    if (menuKey !== -1 && code === menuKey && down) {
      event.preventDefault();
      document.exitPointerLock();
      sketchWindow();
    }
  });
}
