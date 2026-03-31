import { iInputs } from "../consts";
import { getGame, getLocalPlayer, inputHooks } from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { random } from "../util";
import { Switch } from "../krunker-ui/components/Switch";

function pickZeroSome() {
  return random(-0.015, 0.005, true);
}

function isBhoppable() {
  const localPlayer = getLocalPlayer();

  return (
    (sketchConfig.get("wallJump") &&
      getGame().classConfig[getLocalPlayer().classIndex]?.wallJ &&
      localPlayer.wallJump &&
      localPlayer.onWall) ||
    localPlayer.onGround
  );
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
  let lastJump = 0;

  const bhopDelay = 130;

  inputHooks.push((inputs) => {
    const localPlayer = getLocalPlayer();

    const oldBhop = sketchConfig.get("rampAccel");
    const autoSlide = sketchConfig.get("autoSlide");

    if (oldBhop) {
      if (autoSlide && inputs[iInputs.moveDir] !== -1  || inputs[iInputs.jump]) {
        inputs[iInputs.jump] = isBhoppable() ? lastJump : 0;
        lastJump ^= 1;
      }

      // if crouch is held, slidehop
      if (autoSlide || sketchConfig.get("slidehop") && inputs[iInputs.crouch]) {
        const willCrouch = (localPlayer.velocity.y || 0) < 0;
        inputs[iInputs.crouch] = willCrouch ? 1 : 0;
        didCrouch = willCrouch;
      } else {
        didCrouch = false;
      }

      return;
    }

    if (autoSlide && inputs[iInputs.moveDir] !== -1 || sketchConfig.get("bhop") && inputs[iInputs.jump]) {
      const now = Date.now();

      if (bhopTimer <= now) {
        bhopTimer = 0;
        bhopStart = 0;
      }

      // reload for a random amount of frames to simulate pressing it
      // set bhopping only as soon as we start holding the input down
      if (!bhopTimer && isBhoppable()) {
        bhopTimer = now + bhopDelay + random(0, 20);
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
    if (autoSlide || sketchConfig.get("slidehop") && inputs[iInputs.crouch]) {
      if (localPlayer.onGround && !inputs[iInputs.jump] && inputs[iInputs.crouch]) {
        inputs[iInputs.crouch] = 1;
        didCrouch = true;
      }
      else {
        if (!didCrouch) zeroSome = nextZeroSome;

        // pick a new "zeroSome" everytime we slidehop
        // otherwise they will randomly start/stop crouching as zeroSome is recalculated
        // the users will appear to be relatively accurate with slidehopping
        const willCrouch =
          !localPlayer.onGround && (localPlayer.velocity.y || 0) < zeroSome;

        inputs[iInputs.crouch] = willCrouch ? 1 : 0;

        if (!didCrouch && willCrouch) nextZeroSome = pickZeroSome();

        didCrouch = willCrouch;
      }
    } else {
      didCrouch = false;
    }
  });
}

export function BhopMenu() {
  const [bhop, setBhop] = useSketchConfig("bhop");
  const [oldBhop, setOldBhop] = useSketchConfig("rampAccel");
  const [slidehop, setSlidehop] = useSketchConfig("slidehop");
  const [autoSlide, setAutoSlide] = useSketchConfig("autoSlide");
  const [wallJump, setWallJump] = useSketchConfig("wallJump");

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
      <Switch
        title="Autoslide"
        description="Should you automatically slide without holding crouch"
        defaultChecked={autoSlide}
        onChange={(event) => setAutoSlide(event.currentTarget.checked)}
      />
      <Switch
        title="Wall Jump"
        description="If bhop should also automatically jump on walls. Bhop must be enabled."
        defaultChecked={wallJump}
        onChange={(event) => setWallJump(event.currentTarget.checked)}
      />
      <Switch
        title="Old Bhop"
        description="Reverts fixes to automatic bhop"
        defaultChecked={oldBhop}
        onChange={(event) => setOldBhop(event.currentTarget.checked)}
      />
    </>
  );
}
