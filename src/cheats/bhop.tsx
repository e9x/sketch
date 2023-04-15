import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import Switch from "../menu/components/Switch";

const defaultBhop = false;

export function bhopHook() {
  let lastJump = 0;

  inputHooks.push((inputs) => {
    if (!configGet("bhop", defaultBhop)) return;

    const localPlayer = getLocalPlayer();

    if (!localPlayer) return;

    if (inputs[iInputs.jump]) {
      inputs[iInputs.jump] =
        localPlayer.onGround || (localPlayer.wallJump && localPlayer.onWall)
          ? lastJump
          : 0;
      lastJump ^= 1;

      // if crouch isn't already held, override crouch
      if (!inputs[iInputs.crouch])
        inputs[iInputs.crouch] =
          (localPlayer.velocity.y || 0) < 0 ? 1 : inputs[iInputs.crouch];
    }
  });
}

export function BhopMenu() {
  const [bhop, setBhop] = useConfig("bhop", defaultBhop);

  return (
    <Switch
      title="Bhop"
      defaultChecked={bhop}
      onChange={(event) => setBhop(event.currentTarget.checked)}
    />
  );
}
