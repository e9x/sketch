import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getGame, getRender, inputHooks } from "../filters";
import { isEnemy } from "../krunkerUtil";
import BindHolder, { Bind } from "../menu/components/Bind";
import Switch from "../menu/components/Switch";

const defaultTriggerbot = false;
const defaultTriggerbotKey = -1;

export function triggerbotHook() {
  let detectTime = 0;
  const detectDelay = 200;

  inputHooks.push((inputs) => {
    if (!configGet<boolean>("triggerbot", defaultTriggerbot)) return;

    const game = getGame();

    const triggerbotKey = configGet<number>(
      "triggerbotKey",
      defaultTriggerbotKey
    );

    if (
      (triggerbotKey === -1 || game.controls.keys[triggerbotKey] === 1) &&
      inputs[iInputs.scope]
    ) {
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
          console.log("just detected!?");
          detectTime = Date.now() + detectDelay;
        }

        if (detectTime < Date.now()) {
          console.log("shoot everywhere");
          inputs[iInputs.shoot] = 1;
        }
      } else detectTime = 0;
    } else detectTime = 0;
  });
}

export function TriggerbotMenu() {
  const [triggerbot, setTriggerbot] = useConfig<boolean>(
    "triggerbot",
    defaultTriggerbot
  );
  const [triggerbotKey, setTriggerbotKey] = useConfig<number>(
    "triggerbotKey",
    defaultTriggerbotKey
  );

  return (
    <>
      <BindHolder title="Triggerbot Key">
        <Bind
          bind={triggerbotKey}
          setBind={(bind) => setTriggerbotKey(bind)}
          reset={() => setTriggerbotKey(null)}
          unbind={() => setTriggerbotKey(-1)}
        />
      </BindHolder>
      <Switch
        title="Triggerbot"
        description="Shoots enemys that come into your line of sight while you're holding right click"
        defaultChecked={triggerbot}
        onChange={(event) => setTriggerbot(event.currentTarget.checked)}
      />
    </>
  );
}
