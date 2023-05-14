import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import { getAimTime, getCurrentReload, getReload } from "../krunkerUtil";
import Switch from "../menu/components/Switch";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { random } from "../util";

function canShoot(aimTime: number) {
  return !getCurrentReload(aimTime) && !getLocalPlayer().reloadTimer;
}

export function forceAutoHook() {
  let shootTimer = 0;
  let shootStart = 0;

  inputHooks.push((inputs) => {
    if (!sketchConfig.get("forceAuto")) return;

    const localPlayer = getLocalPlayer();

    if (inputs[iInputs.shoot] && localPlayer.weapon.nAuto) {
      const now = Date.now();

      if (shootTimer <= now) {
        shootTimer = 0;
        shootStart = 0;
      }

      if (!shootTimer && canShoot(getAimTime(inputs))) {
        shootTimer = now + getReload() * random(0.8, 0.9, true);
        shootStart = inputs[iInputs.frame] + random(1, 3);
        inputs[iInputs.shoot] = 0;
      } else {
        const mustBhop =
          inputs[iInputs.frame] >= shootStart && now < shootTimer;
        inputs[iInputs.shoot] = mustBhop ? 1 : 0;
      }
    } else {
      shootTimer = 0;
      shootStart = 0;
    }
  });
}

export function ForceAutoMenu() {
  const [triggerbot, setTriggerbot] = useSketchConfig("forceAuto");

  return (
    <Switch
      title="Force Auto"
      description="Makes non-automatic guns automatic"
      defaultChecked={triggerbot}
      onChange={(event) => setTriggerbot(event.currentTarget.checked)}
    />
  );
}
