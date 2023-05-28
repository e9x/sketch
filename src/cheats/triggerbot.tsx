import { iInputs } from "../consts";
import { getGame, getRender, inputHooks } from "../filters";
import { isEnemy } from "../krunkerUtil";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import BindHolder, { Bind } from "krunker-ui/components/Bind";
import Slider from "krunker-ui/components/Slider";
import Switch from "krunker-ui/components/Switch";

export function triggerbotHook() {
  let detectTime = 0;
  let continueTime = 0;
  let didShoot = false;

  inputHooks.push((inputs) => {
    if (!sketchConfig.get("triggerbot")) return;

    const game = getGame();

    const triggerbotKey = sketchConfig.get("triggerbotKey");

    if (
      (triggerbotKey === -1 || game.controls.keys[triggerbotKey] === 1) &&
      inputs[iInputs.scope]
    ) {
      if (Date.now() < continueTime) inputs[iInputs.shoot] = 1;
      else {
        const render = getRender();

        const direction = new game.THREE.Vector3();
        const position = new game.THREE.Vector3();

        render.camera.getWorldDirection(direction);
        render.camera.getWorldPosition(position);

        game.raycaster.set(position, direction);

        let shoot = false;

        for (const player of game.players.list)
          if (
            isEnemy(player) &&
            player.objInstances &&
            player.canBSeen &&
            game.raycaster.intersectObjects(player.objInstances.children, true)
              .length
          ) {
            shoot = true;
            break;
          }

        if (shoot) {
          if (!detectTime) {
            // Date.now() + detectDelay
            detectTime = Date.now() + sketchConfig.get("triggerbotMin") * 1000;
          }

          if (detectTime < Date.now()) {
            inputs[iInputs.shoot] = 1;
          }

          didShoot = true;
        } else if (didShoot) {
          detectTime = 0;
          // Date.now() + continueFor
          continueTime = Date.now() + sketchConfig.get("triggerbotMax") * 1000;
          didShoot = false;
        }
      }
    } else {
      detectTime = 0;
      continueTime = 0;
      didShoot = false;
    }
  });
}

export function TriggerbotMenu() {
  const [triggerbot, setTriggerbot] = useSketchConfig("triggerbot");
  const [triggerbotKey, setTriggerbotKey] = useSketchConfig("triggerbotKey");
  const [triggerbotMin, setTriggerbotMin] = useSketchConfig("triggerbotMin");
  const [triggerbotMax, setTriggerbotMax] = useSketchConfig("triggerbotMax");

  return (
    <>
      <BindHolder title="Triggerbot Key">
        <Bind
          bind={triggerbotKey}
          setBind={(bind) => setTriggerbotKey(bind)}
          reset={() => setTriggerbotKey()}
          unbind={() => setTriggerbotKey(-1)}
        />
      </BindHolder>
      <Switch
        title="Triggerbot"
        description="Shoots enemys that come into your line of sight while you're holding right click"
        defaultChecked={triggerbot}
        onChange={(event) => setTriggerbot(event.currentTarget.checked)}
      />
      <Slider
        title="Triggerbot Minimum (Seconds)"
        defaultValue={triggerbotMin}
        onChange={(event) =>
          setTriggerbotMin(event.currentTarget.valueAsNumber)
        }
        min={0}
        max={1}
        step={0.05}
      />
      <Slider
        title="Triggerbot Maximum (Seconds)"
        defaultValue={triggerbotMax}
        onChange={(event) =>
          setTriggerbotMax(event.currentTarget.valueAsNumber)
        }
        min={0}
        max={1}
        step={0.05}
      />
    </>
  );
}
