import { keyListeners } from "../keys";
import sketchConfig from "../sketchConfig";
import { waitFor } from "../util";
import Menu from "./Menu";
import extendWindows from "./extendWindows";

waitFor(() => typeof windows === "object" && Array.isArray(windows)).then(
  () => {
    const sketchID = extendWindows(
      {
        header: "✏️",
        label: "sketch",
        width: 1100,
        height: "100%",
        popup: true,
        sticky: true,
        forceScroll: true,
      },
      () => <Menu />
    );

    if (sketchConfig.get("menuButton"))
      waitFor(() =>
        document.querySelector<HTMLDivElement>("#menuItemContainer")
      ).then((menuItems) => {
        menuItems.innerHTML += `<div class="menuItem" onmouseenter="playTick()" onclick="playSelect(),showWindow(${sketchID})"><span class="material-icons-outlined menBtnIcn" style="color: #fbff00">edit</span><div class="menuItemTitle">Sketch</div></div>`;
      });

    keyListeners.push((event, code, down) => {
      const menuKey = sketchConfig.get("menuKey");

      if (menuKey !== -1 && code === menuKey && down) {
        event.preventDefault();
        document.exitPointerLock();
        showWindow(sketchID);
      }
    });
  }
);
