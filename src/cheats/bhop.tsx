import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getLocalPlayer, inputHooks } from "../filters";
import Switch from "../menu/components/Switch";
import random from "lodash/random";

function pickZeroSome() {
  return random(-0.015, 0.005, true);
}

function isBhoppable() {
  const localPlayer = getLocalPlayer();

  return (localPlayer.wallJump && localPlayer.onWall) || localPlayer.onGround;
}

export function bhopHook() {
  // value between -1 and 1 that determines the velocity to start slidehopping at
  // positive = going down
  // negative = still increasing in velocity
  let zeroSome = pickZeroSome();
  let nextZeroSome = pickZeroSome();
  let didCrouch = false;
  let bhopTimer = 0;
  let bhopStart = 0;

  // average recorded natural interval
  // not wallhops
  const bhopDelay = 80;

  inputHooks.push((inputs) => {
    const localPlayer = getLocalPlayer();

    if (configGet("bhop") && inputs[iInputs.jump]) {
      const now = Date.now();

      if (bhopTimer <= now) {
        bhopTimer = 0;
        bhopStart = 0;
      }

      // reload for a random amount of frames to simulate pressing it
      // set bhopping only as soon as we start holding the input down
      if (!bhopTimer && isBhoppable()) {
        bhopTimer = now + bhopDelay + random(0, 30);
        bhopStart = inputs[iInputs.frame] + random(1, 3);
        inputs[iInputs.jump] = 0;
      } else {
        const mustBhop = inputs[iInputs.frame] >= bhopStart && now < bhopTimer;
        inputs[iInputs.jump] = mustBhop ? 1 : 0;
      }
    } else {
      bhopTimer = 0;
      bhopStart = 0;
    }

    // if crouch is held, slidehop
    if (configGet("slidehop") && inputs[iInputs.crouch]) {
      if (!didCrouch) zeroSome = nextZeroSome;

      // pick a new "zeroSome" everytime we slidehop
      // otherwise they will randomly start/stop crouching as zeroSome is recalculated
      // the users will appear to be relatively accurate with slidehopping
      const willCrouch = (localPlayer.velocity.y || 0) < zeroSome;

      inputs[iInputs.crouch] = willCrouch ? 1 : 0;

      if (!didCrouch && willCrouch) nextZeroSome = pickZeroSome();

      didCrouch = willCrouch;
    } else {
      didCrouch = false;
    }
  });
}

export function BhopMenu() {
  const [bhop, setBhop] = useConfig("bhop");
  const [slidehop, setSlidehop] = useConfig("slidehop");

  return (
    <>
      <Switch
        title="Bhop"
        description="Hold space to bhop"
        defaultChecked={bhop}
        onChange={(event) => setBhop(event.currentTarget.checked)}
      />
      <Switch
        title="Slidehop"
        description="Hold crouch to slidehop"
        defaultChecked={slidehop}
        onChange={(event) => setSlidehop(event.currentTarget.checked)}
      />
    </>
  );
}
