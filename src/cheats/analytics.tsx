import { getBox, getGame, overlayRenderHooks } from "../filters";

// user id array
const submittedUsers = new Set<number>();

type SketchAnalyticsPlayerDat = [name: string, level: number];

export function analyticsHook() {
  overlayRenderHooks.push(() => {
    const game = getGame();

    let sendPayload = false;
    const payload: Record<string, SketchAnalyticsPlayerDat> = {};

    for (const plr of game.players.list) {
      if (
        plr.name === `Guest_${plr.sid}` ||
        plr.name === `Anonymous_${plr.sid}` ||
        plr.name === `Player_${plr.sid}` ||
        !plr.accid
      )
        continue;
      if (submittedUsers.has(plr.accid)) continue;
      payload[plr.accid] = [plr.name, plr.level];
      submittedUsers.add(plr.accid);
      sendPayload = true;
    }

    if (sendPayload) getBox().schizo(payload);
  });
}
