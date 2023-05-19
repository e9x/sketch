import { keyListeners } from "../keys";
import sketchConfig from "../sketchConfig";
import Menu from "./Menu";
import createRenderContainer from "./renderContainer";

function sketchWindow() {
  const html = createRenderContainer(() => <Menu />);

  const window: GameWindowRender = {
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
  windows[0] = window;
  showWindow(1);
  windows[0] = old0;
}

export function sketchButton() {
  if (sketchConfig.get("menuButton")) {
    const menuItemContainer =
      document.querySelector<HTMLDivElement>("#menuItemContainer");
    if (menuItemContainer)
      menuItemContainer.innerHTML += `<div class="menuItem" onmouseenter="playTick()" onclick="playSelect()" id="sketchMenu"><span class="material-icons-outlined menBtnIcn" style="color: #fbff00">edit</span><div class="menuItemTitle">Sketch</div></div>`;

    const sketchMenu = document.getElementById("sketchMenu") as HTMLDivElement;
    sketchMenu.removeAttribute("id");
    sketchMenu.addEventListener("click", sketchWindow);
  }

  keyListeners.push((event, code, down) => {
    const menuKey = sketchConfig.get("menuKey");

    if (menuKey !== -1 && code === menuKey && down) {
      event.preventDefault();
      document.exitPointerLock();
      sketchWindow();
    }
  });
}
