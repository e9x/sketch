import {
  getConfig,
  getGame,
  getLocalPlayer,
  getRender,
  inputHooks,
} from "../filters";
import { lerp } from "../krunkerUtil";
import BindHolder, { Bind } from "../menu/components/Bind";
import Slider from "../menu/components/Slider";
import Switch from "../menu/components/Switch";
import sketchConfig, { useSketchConfig } from "../sketchConfig";

export function recoilControlHook() {
  let lastRecoilAnimY = 0;

  inputHooks.push(() => {
    if (!sketchConfig.get("recoilControl")) return;

    const game = getGame();

    const recoilControlKey = sketchConfig.get("recoilControlKey");

    if (recoilControlKey !== -1 && game.controls.keys[recoilControlKey] !== 1)
      return;

    const render = getRender();
    const config = getConfig();
    const localPlayer = getLocalPlayer();

    const { THREE } = render;

    const rotation = new THREE.Vector2(
      game.controls.pchObjc.rotation.x +
        lastRecoilAnimY * config.recoilMlt -
        localPlayer.recoilAnimY * config.recoilMlt,
      game.controls.object.rotation.y
    );

    lastRecoilAnimY = localPlayer.recoilAnimY;

    lerp(
      rotation,
      new THREE.Vector2(
        game.controls.pchObjc.rotation.x,
        game.controls.object.rotation.y
      ),
      sketchConfig.get("recoilSmoothFactor")
    );

    game.controls.pchObjc.rotation.x = rotation.x;
    game.controls.object.rotation.y = rotation.y;

    render.updateFrustum();
  });
}

export function RecoilControlMenu() {
  const [recoilControl, setRecoilControl] = useSketchConfig("recoilControl");
  const [recoilControlKey, setRecoilControlKey] =
    useSketchConfig("recoilControlKey");
  const [recoilSmoothFactor, setRecoilSmoothFactor] =
    useSketchConfig("recoilSmoothFactor");

  return (
    <>
      <BindHolder title="Recoil Control Key">
        <Bind
          bind={recoilControlKey}
          setBind={(bind) => setRecoilControlKey(bind)}
          reset={() => setRecoilControlKey()}
          unbind={() => setRecoilControlKey(-1)}
        />
      </BindHolder>
      <Switch
        title="Recoil Control"
        defaultChecked={recoilControl}
        onChange={(event) => setRecoilControl(event.currentTarget.checked)}
      />
      <Slider
        title="Recoil Smooth Factor"
        description="Controls the speed of the aimbot's rotation"
        defaultValue={recoilSmoothFactor}
        min={0}
        max={1}
        step={0.05}
        onChange={(event) =>
          setRecoilSmoothFactor(event.currentTarget.valueAsNumber)
        }
      />
    </>
  );
}
