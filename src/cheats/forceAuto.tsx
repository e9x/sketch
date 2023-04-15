import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import Switch from "../menu/components/Switch";

const defaultForceAuto = false;

export function forceAutoHook() {
  let lastShoot = 1;

  inputHooks.push((inputs) => {
    if (!configGet("forceauto", defaultForceAuto)) return;

    const localPlayer = getLocalPlayer();

    if (localPlayer.weapon?.nAuto && inputs[iInputs.shoot]) {
      inputs[iInputs.shoot] = lastShoot;
      lastShoot ^= 1;
    }
  });
}

export function ForceAutoMenu() {
  const [triggerbot, setTriggerbot] = useConfig("forceauto", defaultForceAuto);

  return (
    <Switch
      title="Force Auto"
      description="Makes non-automatic guns automatic"
      defaultChecked={triggerbot}
      onChange={(event) => setTriggerbot(event.currentTarget.checked)}
    />
  );
}
