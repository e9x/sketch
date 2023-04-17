import useConfig, { configGet } from "../config";
import { iInputs } from "../consts";
import { getGame, getRender, inputHooks } from "../filters";
import { isEnemy } from "../krunkerUtil";
import Switch from "../menu/components/Switch";

const defaultTriggerbot = false;

export function triggerbotHook() {
  inputHooks.push((inputs) => {
    if (!configGet<boolean>("triggerbot", defaultTriggerbot)) return;

    if (!inputs[iInputs.scope]) return;

    const game = getGame();
    const render = getRender();

    const direction = new game.THREE.Vector3();
    const position = new game.THREE.Vector3();

    render.camera.getWorldDirection(direction);
    render.camera.getWorldPosition(position);

    game.raycaster.set(position, direction);

    for (const player of game.players.list)
      if (
        isEnemy(player) &&
        player.objInstances &&
        player.canBSeen &&
        game.raycaster.intersectObjects(player.objInstances.children, true)
          .length
      ) {
        inputs[iInputs.shoot] = 1;
        break;
      }
  });
}

export function TriggerbotMenu() {
  const [triggerbot, setTriggerbot] = useConfig(
    "triggerbot",
    defaultTriggerbot
  );

  return (
    <Switch
      title="Triggerbot"
      description="Shoots enemys that come into your line of sight while you're holding right click"
      defaultChecked={triggerbot}
      onChange={(event) => setTriggerbot(event.currentTarget.checked)}
    />
  );
}
