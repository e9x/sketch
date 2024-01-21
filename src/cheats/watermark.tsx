import { getOverlay, overlayRenderHooks } from "../filters";
import { getFPS, getPing, isInMenus } from "../krunkerUtil";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import Switch from "krunker-ui/components/Switch";

const userPreference = ["en-US", "en-GB", "my"].includes(navigator.language)
  ? "12"
  : "24";

function formatDate(date: Date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  if (userPreference === "12") {
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const adjustedMinutes = minutes < 10 ? "0" + minutes : minutes;
    const adjustedSeconds = seconds < 10 ? "0" + seconds : seconds;
    return `${hours}:${adjustedMinutes}:${adjustedSeconds} ${period}`;
  } else {
    const adjustedHours = hours < 10 ? "0" + hours : hours;
    10 ? "0" + minutes : minutes;
    const adjustedSeconds = seconds < 10 ? "0" + seconds : seconds;
    return `${adjustedHours}:${minutes}:${adjustedSeconds}`;
  }
}

export function watermarkHook() {
  overlayRenderHooks.push(() => {
    if (sketchConfig.get("watermark") && !isInMenus()) {
      const yap = `Sketch - FPS: ${getFPS()} | Ping: ${getPing()} | Time: ${formatDate(
        new Date()
      )}`;

      const overlay = getOverlay();
      overlay.ctx.save();
      overlay.ctx.scale(overlay.scale, overlay.scale);

      const width = overlay.canvas.width / overlay.scale;

      overlay.ctx.font = "16px 'gamefont'";

      const metrics = overlay.ctx.measureText(yap);
      const fontHeight =
        metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent;

      const boxPadding = 24; // inset

      const boxWidth = metrics.width + boxPadding;
      const boxHeight = 50;

      const boxX = width / 2 - boxWidth / 2;
      const boxY = 10;

      overlay.ctx.fillStyle = "#202020e2";
      overlay.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      overlay.ctx.translate(boxX + boxPadding / 2, boxY + boxPadding / 2);

      const boxInsetWidth = boxWidth - boxPadding;
      const boxInsetHeight = boxHeight - boxPadding;

      overlay.ctx.textAlign = "center";
      overlay.ctx.textBaseline = "middle";
      overlay.ctx.fillStyle = "#fff";

      overlay.ctx.fillText(
        yap,
        boxInsetWidth / 2,
        boxInsetHeight / 2 + fontHeight / 2
      );

      overlay.ctx.restore();
    }
  });
}

export function WatermarkMenu() {
  const [watermark, setWatermark] = useSketchConfig("watermark");

  return (
    <Switch
      title="Watermark"
      description="Shows a watermark in game."
      defaultChecked={watermark}
      onChange={(event) => setWatermark(event.currentTarget.checked)}
    />
  );
}
