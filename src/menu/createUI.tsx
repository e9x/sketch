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
        popup: true,
      },
      () => <Menu />
    );

    waitFor(() =>
      document.querySelector<HTMLDivElement>("#menuItemContainer")
    ).then((menuItems) => {
      menuItems.innerHTML += `<div class="menuItem" onmouseenter="playTick()" onclick="playSelect(),showWindow(${sketchID})"><span class="material-icons-outlined menBtnIcn" style="color: #fbff00">edit</span><div class="menuItemTitle">Sketch</div></div>`;
    });
  }
);
