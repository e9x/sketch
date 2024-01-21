import { getOverlay, overlayRenderHooks } from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import Switch from "krunker-ui/components/Switch";
import { getKeyName } from "krunker-ui/keys";
import { isInMenus } from "krunkerUtil";

export function keybindOverlayHook() {
  overlayRenderHooks.push(() => {
    if (sketchConfig.get("keybindOverlay") && !isInMenus()) {
      const keybinds: { name: string; key: number }[] = [
        {
          name: "Menu",
          key: sketchConfig.get("menuKey"),
        },
        {
          name: "Aim",
          key: sketchConfig.get("aimKey"),
        },
        {
          name: "Triggerbot",
          key: sketchConfig.get("triggerbotKey"),
        },
        {
          name: "Recoil Control",
          key: sketchConfig.get("recoilControlKey"),
        },
      ];

      const overlay = getOverlay();
      overlay.ctx.save();
      overlay.ctx.scale(overlay.scale, overlay.scale);

      const height = overlay.canvas.height / overlay.scale;

      const keyHeight = 35;
      const keyHeightGap = 8;

      const boxPadding = 24; // inset

      const boxWidth = 300;
      const boxHeight =
        keyHeight * keybinds.length +
        keyHeightGap * (keybinds.length - 1) +
        boxPadding;
      const boxX = 10;
      const boxY = height / 2 - boxHeight / 2;

      overlay.ctx.fillStyle = "#202020e2";
      overlay.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      overlay.ctx.translate(boxX + boxPadding / 2, boxY + boxPadding / 2);

      const boxInsetWidth = boxWidth - boxPadding;

      overlay.ctx.textBaseline = "middle";
      overlay.ctx.font = "16px 'gamefont'";

      // get font height
      const metrics = overlay.ctx.measureText("");
      const fontHeight =
        metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent;

      for (let i = 0; i < keybinds.length; i++) {
        // overlay.ctx.fillStyle = i % 2 === 0 ? "#F00" : "#F0F";
        // overlay.ctx.fillRect(0, 0, boxInsetWidth, keyHeight);

        overlay.ctx.fillStyle = "#a5a5a5";

        overlay.ctx.fillText(keybinds[i].name, 0, keyHeight / 2 + fontHeight);

        const keyName = getKeyName(keybinds[i].key);

        overlay.ctx.save();
        const keyWidth = overlay.ctx.measureText(keyName).width + 20;

        overlay.ctx.translate(boxInsetWidth - keyWidth, 0);

        overlay.ctx.fillStyle = "#888";
        overlay.ctx.fillRect(0, 0, keyWidth, keyHeight);

        const border = 2;
        overlay.ctx.fillStyle = "#101010";
        overlay.ctx.fillRect(
          border,
          border,
          keyWidth - border * 2,
          keyHeight - border * 2
        );

        overlay.ctx.textAlign = "center";
        overlay.ctx.fillStyle = "#fff";
        overlay.ctx.fillText(keyName, keyWidth / 2, keyHeight / 2 + fontHeight);
        overlay.ctx.restore();

        overlay.ctx.translate(0, keyHeight + keyHeightGap);
      }

      overlay.ctx.restore();
    }
  });
}

export function KeybindOverlayMenu() {
  const [keybindOverlay, setKeybindOverlay] = useSketchConfig("keybindOverlay");

  return (
    <Switch
      title="Keybind Overlay"
      description="Shows an in-game overlay of a list of your keybinds"
      defaultChecked={keybindOverlay}
      onChange={(event) => setKeybindOverlay(event.currentTarget.checked)}
    />
  );
}
