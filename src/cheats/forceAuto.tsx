import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import { getAimTime, getCurrentReload } from "../krunkerUtil";
import Switch from "../menu/components/Switch";

export function forceAutoHook() {
  let lastShoot = 1;

  inputHooks.push((inputs) => {
    if (!configGet("forceAuto")) return;

    const localPlayer = getLocalPlayer();

    if (
      localPlayer.weapon.nAuto &&
      inputs[iInputs.shoot] &&
      !getCurrentReload(getAimTime(inputs)) &&
      !localPlayer.reloadTimer
    ) {
      inputs[iInputs.shoot] = lastShoot;
      lastShoot ^= 1;
    }
  });
}

export function ForceAutoMenu() {
  const [triggerbot, setTriggerbot] = useConfig("forceAuto");

  return (
    <Switch
      title="Force Auto"
      description="Makes non-automatic guns automatic"
      defaultChecked={triggerbot}
      onChange={(event) => setTriggerbot(event.currentTarget.checked)}
    />
  );
}
