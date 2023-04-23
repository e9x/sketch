import { configGet } from "../config";
import { keyListeners } from "../keys";
import { waitFor } from "../util";
import Menu, { defaultMenuButton, defaultMenuKey } from "./Menu";
import extendWindows from "./extendWindows";

waitFor(() => typeof windows === "object" && Array.isArray(windows)).then(
  () => {
    const sketchID = extendWindows(
      {
        header: "✏️",
        label: "sketch",
        width: 1100,
        popup: true,
      },
      () => <Menu />
    );

    if (configGet<boolean>("menuButton", defaultMenuButton))
      waitFor(() =>
        document.querySelector<HTMLDivElement>("#menuItemContainer")
      ).then((menuItems) => {
        menuItems.innerHTML += `<div class="menuItem" onmouseenter="playTick()" onclick="playSelect(),showWindow(${sketchID})"><span class="material-icons-outlined menBtnIcn" style="color: #fbff00">edit</span><div class="menuItemTitle">Sketch</div></div>`;
      });

    keyListeners.push((event, code, down) => {
      const menuKey = configGet<number>("menuKey", defaultMenuKey);

      if (menuKey !== -1 && code === menuKey && down) {
        event.preventDefault();
        showWindow(sketchID);
      }
    });
  }
);
