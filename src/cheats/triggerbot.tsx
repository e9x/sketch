import { iInputs } from "../consts";
import { getGame, getLocalPlayer, getRender, inputHooks } from "../filters";
import { getPlayerMeshes, isEnemy } from "../krunkerUtil";
import type { OBB } from "../lib/obb";
import { createOBB } from "../lib/obb";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { BindHolder, Bind } from "krunker-ui/components/Bind";
import { Slider } from "krunker-ui/components/Slider";
import { Switch } from "krunker-ui/components/Switch";

let triggerbotWantsShoot = false;

/**
 *
 * @returns Whether triggerbot set inputs[iInputs.shoot] on the current inputHooks frame
 */
export function getTriggerbotWantsShoot() {
  return triggerbotWantsShoot;
}

export function triggerbotHook() {
  let detectTime = 0;
  let continueTime = 0;
  let didShoot = false;

  let raycaster: THREE.Raycaster | undefined;

  let obb: OBB | undefined;

  inputHooks.push((inputs) => {
    triggerbotWantsShoot = false;

    const triggerbotSmoothBot =
      sketchConfig.get("aimbot") === "smooth" && sketchConfig.get("bot");

    if (!triggerbotSmoothBot && !sketchConfig.get("triggerbot")) return;

    const game = getGame();

    const triggerbotKey = sketchConfig.get("triggerbotKey");

    if (
      (triggerbotSmoothBot ||
        triggerbotKey === -1 ||
        game.controls.keys[triggerbotKey] === 1) &&
      // differs from aimbot because aimbot always requires a scope, this requires u to just look at an enemy while scoped
      // TODO: make the scope configurable: require scope - if triggerbot requires you to be aimed
      // auto scope - automatically scopes in then shoots
      (inputs[iInputs.scope] || getLocalPlayer().weapon.noAim)
    ) {
      if (Date.now() < continueTime) inputs[iInputs.shoot] = 1;
      else {
        const render = getRender();

        const direction = new game.THREE.Vector3();
        const position = new game.THREE.Vector3();

        render.camera.getWorldDirection(direction);
        render.camera.getWorldPosition(position);

        if (!raycaster) raycaster = new game.THREE.Raycaster();

        raycaster.set(position, direction);

        let shoot = false;

        const triggerbotDistance = sketchConfig.get("triggerbotDistance");

        for (const player of game.players.list)
          if (isEnemy(player) && player.objInstances && player.canBSeen) {
            const box = new game.THREE.Box3();

            for (const mesh of getPlayerMeshes(player, false))
              if (mesh.visible) box.expandByObject(mesh);

            box.expandByScalar(triggerbotDistance);

            if (!obb) obb = createOBB(game.THREE);
            obb.rotation.setFromMatrix4(player.objInstances.matrixWorld);
            obb.halfSize.subVectors(box.max, box.min).multiplyScalar(0.5);
            obb.center.addVectors(box.min, obb.halfSize);

            const hit = obb.intersectsRay(raycaster.ray);

            if (hit) {
              shoot = true;
              break;
            }
          }

        if (shoot) {
          if (!detectTime) {
            // Date.now() + detectDelay
            detectTime =
              Date.now() +
              (triggerbotSmoothBot ? 0 : sketchConfig.get("triggerbotMin")) *
                1000;
          }

          if (detectTime < Date.now()) {
            inputs[iInputs.shoot] = 1;
            inputs[iInputs.scope] = 1;
            // for forceAuto
            triggerbotWantsShoot = true;
          }

          didShoot = true;
        } else if (didShoot) {
          detectTime = 0;
          // Date.now() + continueFor
          continueTime =
            Date.now() +
            (triggerbotSmoothBot ? 0 : sketchConfig.get("triggerbotMax")) *
              1000;
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
  const [triggerbotDistance, settriggerbotDistance] =
    useSketchConfig("triggerbotDistance");

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
        title="Triggerbot Distance"
        description="Distance from the enemy that triggerbot will target. 1 = shoots when any part of enemy is in crosshair, 10 = shoots even when the enemy is near the crosshair"
        defaultValue={triggerbotDistance}
        onChange={(event) =>
          settriggerbotDistance(event.currentTarget.valueAsNumber)
        }
        min={0}
        max={10}
        step={0.5}
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
