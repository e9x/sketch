import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import { getAimTime, canShoot, getReload } from "../krunkerUtil";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { random } from "../util";
import { getTriggerbotWantsShoot } from "./triggerbot";
import { Switch } from "krunker-ui/components/Switch";

export function forceAutoHook() {
  let shootTimer = 0;
  let shootStart = 0;

  inputHooks.push((inputs) => {
    // Run forceAuto if triggerbot was the cause of inputs[iInputs.shoot] being set
    // Relies on forceAutoHook() being called after triggerbotHook()
    if (!sketchConfig.get("forceAuto") && !getTriggerbotWantsShoot()) return;

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
  const [forceAuto, setForceAuto] = useSketchConfig("forceAuto");

  return (
    <Switch
      title="Force Auto"
      description="Makes non-automatic guns automatic"
      defaultChecked={forceAuto}
      onChange={(event) => setForceAuto(event.currentTarget.checked)}
    />
  );
}
