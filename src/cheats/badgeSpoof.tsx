import {
  getGame,
  getLocalPlayer,
  getMenuPlayer,
  inputHooks,
  onGameHooks,
  onPlayerAddHooks,
  overlayRenderHooks,
} from "../filters";
import { getExposedWindow } from "../consts";
import type { Player } from "../krunker/Player";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Switch } from "../krunker-ui/components/Switch";
import { Text } from "../krunker-ui/components/Text";

const badgeLock = Symbol("badgeLock");
let monitorStarted = false;
let rainbowLoopStarted = false;
let configWatcherStarted = false;
let rainbowObserverStarted = false;
let rainbowRefreshQueued = false;
let uiRefreshQueued = false;
let nameSyncMonitorStarted = false;
const randomSuffix = Math.random().toString(36).slice(2, 10);
const rainbowMarkerAttr = `data-r_${randomSuffix}`;
let lastRainbowTag = "";
export let sharedRainbowHexColor = "#fb4a4a";

type AnyObj = Record<PropertyKey, any>;
const VIP_BADGE_ID = 18;

function isPlaceholderName(value: unknown) {
  return typeof value === "string" && value.trim().toLowerCase() === "preview";
}

function pickRealName(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || isPlaceholderName(trimmed)) continue;
    return trimmed;
  }
  return "";
}

function getVipBadgeIndex() {
  try {
    const game = getGame() as AnyObj;
    const badges = game?.badges as AnyObj[] | undefined;
    if (Array.isArray(badges)) {
      const found = badges.find((badge) => badge?.id === VIP_BADGE_ID);
      if (found) {
        const explicitIndex = Number(found.index);
        if (Number.isInteger(explicitIndex) && explicitIndex >= 0) return explicitIndex;
      }

      const pos = badges.findIndex((badge) => badge?.id === VIP_BADGE_ID);
      if (pos >= 0) return pos;
    }
  } catch {}

  return -1;
}

function hueToSharedRainbowHex(hueDeg: number) {
  const s = 0.96;
  const l = 0.62;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hue = ((hueDeg % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getResolvedDisplayName() {
  try {
    const spoofEnabled = sketchConfig.get("displayNameSpoofEnabled");
    const spoofed = sketchConfig.get("displayNameSpoof").trim();
    const hideOnEnd = sketchConfig.get("badgeSpoofHideEndScreen") && isOnEndScreen();
    if (spoofEnabled && spoofed && !hideOnEnd) return spoofed;
  } catch {}

  try {
    const menuPlayer = getMenuPlayer() as AnyObj | undefined;
    const localPlayer = getLocalPlayer() as AnyObj | undefined;
    const localAccount = localPlayer?.account as AnyObj | undefined;
    const menuAccount = menuPlayer?.account as AnyObj | undefined;

    return pickRealName(
      localAccount?.alias,
      localPlayer?.alias,
      localAccount?.name,
      localPlayer?.name,
      menuAccount?.alias,
      menuPlayer?.alias,
      menuAccount?.name,
      menuPlayer?.name,
    );
  } catch {
    return "";
  }
}

function syncDisplayNameUI() {
  try {
    // Menu labels are separate from scoreboard widgets; patch them directly.
    const resolvedName = getResolvedDisplayName();

    if (resolvedName) {
      const menuNameIds = [
        "menuAccountUsername",
        "menuUsername",
        "menuAccountName",
        "menuUserName",
      ];

      for (const id of menuNameIds) {
        const el = document.getElementById(id);
        if (el) el.textContent = resolvedName;
      }
    }
  } catch {}
}

function refreshGameUI() {
  syncDisplayNameUI();

  try {
    const w = getExposedWindow() as any;
    // windows[22] is the in-game player list panel; searchPlayers() rebuilds its innerHTML
    if (document.getElementById("playerListH")) {
      w.windows?.[22]?.searchPlayers?.();
    }

    // switchLeaderboard is not a pure refresh API; preserve current visibility so it redraws
    // without collapsing the leaderboard UI.
    const leaderboardHolder = document.getElementById("leaderboardHolder");
    if (leaderboardHolder && typeof w.switchLeaderboard === "function") {
      const visible = leaderboardHolder.style.display !== "none";
      w.switchLeaderboard(visible);
    }
  } catch {}
}

function queueGameUIRefresh() {
  if (uiRefreshQueued) return;
  uiRefreshQueued = true;

  requestAnimationFrame(() => {
    uiRefreshQueued = false;
    refreshGameUI();
  });
}

function isOnEndScreen() {
  return document.getElementById("uiBase")?.classList.contains("onEndScrn") ?? false;
}

function defineSpoofedProperty(
  target: AnyObj,
  key: string,
  forcedValue: () => any,
  forceWhen: () => boolean,
) {
  if (!target || typeof target !== "object") return;

  const existing = Object.getOwnPropertyDescriptor(target, key);
  let backing = target[key];

  if (existing && existing.configurable === false) return;

  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: existing?.enumerable ?? true,
    get() {
      return forceWhen() ? forcedValue() : backing;
    },
    set(value) {
      // Keep the last non-spoofed value around so disabling a spoof reverts instantly.
      // forceApplySpoofs() writes the forced value through this setter every frame.
      try {
        if (forceWhen() && value === forcedValue()) return;
      } catch {}

      backing = value;
    },
  });
}

function defineVipTierProperty(target: AnyObj, forceWhen: () => boolean) {
  if (!target || typeof target !== "object") return;

  const existing = Object.getOwnPropertyDescriptor(target, "BP");
  let backing = target.BP;

  if (existing && existing.configurable === false) return;

  Object.defineProperty(target, "BP", {
    configurable: true,
    enumerable: existing?.enumerable ?? true,
    get() {
      if (!forceWhen()) return backing;

      const current =
        backing && typeof backing === "object" ? (backing as AnyObj) : ({} as AnyObj);
      const tier = Number(current.tier) || 0;
      return {
        ...current,
        tier: Math.max(1, tier),
      };
    },
    set(value) {
      backing = value;
    },
  });
}

function installLocks(player: Player) {
  const p = player as AnyObj;
  const hideOnEndScreen = () => sketchConfig.get("badgeSpoofHideEndScreen") && isOnEndScreen();
  const fakeClanEnabled = () => sketchConfig.get("fakeClanTagEnabled");
  const fakeClanValue = () => sketchConfig.get("fakeClanTag").trim();
  const fakeClanActive = () => fakeClanEnabled() && fakeClanValue().length > 0 && !hideOnEndScreen();
  const fakeNameEnabled = () => sketchConfig.get("displayNameSpoofEnabled");
  const fakeNameValue = () => sketchConfig.get("displayNameSpoof").trim();
  const fakeNameActive = () => fakeNameEnabled() && fakeNameValue().length > 0 && !hideOnEndScreen();
  const verifiedActive = () => sketchConfig.get("badgeSpoofVerified") && !hideOnEndScreen();
  const vipActive = () => sketchConfig.get("fakeVipStatusEnabled") && !hideOnEndScreen();
  const premiumActive = () => (sketchConfig.get("fakePremiumEnabled") || vipActive()) && !hideOnEndScreen();

  if (!p[badgeLock]) {
    p[badgeLock] = true;

    defineSpoofedProperty(
      p,
      "featured",
      () => 1,
      () => verifiedActive(),
    );

    defineSpoofedProperty(
      p,
      "emailVerified",
      () => true,
      () => verifiedActive(),
    );

    defineSpoofedProperty(
      p,
      "premiumT",
      () => 1,
      () => premiumActive(),
    );

    defineSpoofedProperty(
      p,
      "badgeIndex",
      () => getVipBadgeIndex(),
      () => vipActive() && getVipBadgeIndex() >= 0,
    );

    defineVipTierProperty(p, () => vipActive());

    defineSpoofedProperty(p, "clan", () => fakeClanValue(), () => fakeClanActive());
    defineSpoofedProperty(p, "name", () => fakeNameValue(), () => fakeNameActive());
    defineSpoofedProperty(p, "alias", () => fakeNameValue(), () => fakeNameActive());
    defineSpoofedProperty(
      p,
      "fakeName",
      () => fakeNameValue(),
      () => fakeNameActive(),
    );
  }

  const account = p.account as AnyObj | undefined;

  if (!account || account[badgeLock]) return;

  account[badgeLock] = true;

  defineSpoofedProperty(
    account,
    "featured",
    () => 1,
    () => verifiedActive(),
  );

  defineSpoofedProperty(
    account,
    "emailVerified",
    () => true,
    () => verifiedActive(),
  );

  defineSpoofedProperty(
    account,
    "premiumT",
    () => 1,
    () => premiumActive(),
  );

  defineVipTierProperty(account, () => vipActive());

  defineSpoofedProperty(
    account,
    "clan",
    () => fakeClanValue(),
    () => fakeClanActive(),
  );

  defineSpoofedProperty(account, "name", () => fakeNameValue(), () => fakeNameActive());
  defineSpoofedProperty(
    account,
    "alias",
    () => fakeNameValue(),
    () => fakeNameActive(),
  );
}

function forceApplySpoofs(player: Player) {
  const account = (player as AnyObj).account as AnyObj | undefined;
  const onEnd = sketchConfig.get("badgeSpoofHideEndScreen") && isOnEndScreen();

  if (sketchConfig.get("badgeSpoofVerified") && !onEnd) {
    (player as AnyObj).featured = 1;
    (player as AnyObj).emailVerified = true;
    if (account) {
      account.featured = 1;
      account.emailVerified = true;
    }
  }

  if (sketchConfig.get("fakeClanTagEnabled") && !onEnd) {
    const tag = sketchConfig.get("fakeClanTag").trim();
    if (tag) {
      (player as AnyObj).clan = tag;
      if (account) account.clan = tag;
    }
  }

  if (sketchConfig.get("displayNameSpoofEnabled") && !onEnd) {
    const displayName = sketchConfig.get("displayNameSpoof").trim();
    if (displayName) {
      (player as AnyObj).name = displayName;
      (player as AnyObj).alias = displayName;
      (player as AnyObj).fakeName = displayName;
      if (account) {
        account.name = displayName;
        account.alias = displayName;
      }
    }
  }

  if ((sketchConfig.get("fakePremiumEnabled") || sketchConfig.get("fakeVipStatusEnabled")) && !onEnd) {
    (player as AnyObj).premiumT = 1;
    const showBadges = (player as AnyObj).showBadges;
    if (showBadges && typeof showBadges === "object") {
      showBadges.premium = true;
    }
    if (account) account.premiumT = 1;
  }

  if (sketchConfig.get("fakeVipStatusEnabled") && !onEnd) {
    const vipBadgeIndex = getVipBadgeIndex();

    const ensureVipTier = (obj: AnyObj | undefined) => {
      if (!obj) return;
      const bp = obj.BP && typeof obj.BP === "object" ? (obj.BP as AnyObj) : {};
      const tier = Number(bp.tier) || 0;
      obj.BP = {
        ...bp,
        tier: Math.max(1, tier),
      };
    };

    ensureVipTier(player as AnyObj);
    ensureVipTier(account);

    if (vipBadgeIndex >= 0) {
      (player as AnyObj).badgeIndex = vipBadgeIndex;
      const showBadges = (player as AnyObj).showBadges;
      if (showBadges && typeof showBadges === "object") {
        showBadges.custom = true;
      }
    }
  }

}

function applySpoofsNow() {
  try {
    const menuPlayer = getMenuPlayer();
    if (menuPlayer) {
      installLocks(menuPlayer);
      forceApplySpoofs(menuPlayer);
    }
  } catch {}

  try {
    const localPlayer = getLocalPlayer();
    if (localPlayer) {
      installLocks(localPlayer);
      forceApplySpoofs(localPlayer);
    }
  } catch {}

  try {
    const game = getGame();
    for (const player of game.players.list as unknown as Player[]) {
      if ((player as AnyObj)?.isYou) {
        installLocks(player);
        forceApplySpoofs(player);
      }
    }
  } catch {}
}


function updateRainbowSpanColors() {
  const now = Date.now();
  const cycleMs = 4800;
  const baseHue = ((now % cycleMs) / cycleMs) * 360;
  sharedRainbowHexColor = hueToSharedRainbowHex(baseHue);

  const spans = document.querySelectorAll<HTMLElement>(
    `span[${rainbowMarkerAttr}="1"]`,
  );
  if (!spans.length) return;

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const hue = (((now + i * 180) % cycleMs) / cycleMs) * 360;
    span.style.setProperty("color", `hsl(${hue.toFixed(1)} 96% 62%)`, "important");
  }
}

function clearClanRainbowSpans() {
  const nodes = document.querySelectorAll<HTMLElement>(`[${rainbowMarkerAttr}="1"]`);
  for (const node of nodes) {
    const origColor = node.dataset.rbOrigColor ?? "";
    node.style.removeProperty("color");
    if (origColor) node.style.setProperty("color", origColor);
    delete node.dataset.rbOrigColor;
    node.removeAttribute(rainbowMarkerAttr);
  }
}

function updateRainbowBadges() {
  const enabled = sketchConfig.get("badgeRainbow") && sketchConfig.get("fakeClanTagEnabled");
  const fakeTag = sketchConfig.get("fakeClanTag").trim();

  if (!enabled || !fakeTag || (sketchConfig.get("badgeSpoofHideEndScreen") && isOnEndScreen())) {
    clearClanRainbowSpans();
    lastRainbowTag = "";
    return;
  }

  if (lastRainbowTag && lastRainbowTag.toLowerCase() !== fakeTag.toLowerCase()) {
    clearClanRainbowSpans();
  }
  lastRainbowTag = fakeTag;

  // The game renders clan tags as: <span style='color:CLANCOLOR'> [CLAN]</span>
  // For players in a real clan, CLANCOLOR may be gold (#FBC02D) for known clans.
  // Tag the game's existing wrapper span directly so updateRainbowSpanColors can
  // apply !important color to it — no child-span injection, no CSS inheritance fight.
  const expectedText = `[${fakeTag}]`;
  const allSpans = document.querySelectorAll<HTMLElement>('span[style*="color"]');
  for (const span of allSpans) {
    if (span.textContent?.trim() === expectedText && !span.hasAttribute(rainbowMarkerAttr)) {
      span.dataset.rbOrigColor = span.style.getPropertyValue("color");
      span.setAttribute(rainbowMarkerAttr, "1");
    }
  }
}

function queueRainbowRefresh() {
  if (rainbowRefreshQueued) return;
  rainbowRefreshQueued = true;

  requestAnimationFrame(() => {
    rainbowRefreshQueued = false;
    updateRainbowBadges();
    updateRainbowSpanColors();
  });
}

function startRainbowObserver() {
  if (rainbowObserverStarted) return;
  rainbowObserverStarted = true;

  const root = document.body || document.documentElement;
  if (!root) return;

  const observer = new MutationObserver(() => {
    queueRainbowRefresh();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function startRainbowLoop() {
  if (rainbowLoopStarted) return;
  rainbowLoopStarted = true;

  startRainbowObserver();
  queueRainbowRefresh();

  // Only update colors in the interval (cheap CSS). DOM restructuring is handled
  // by the MutationObserver so it only runs when content actually changes.
  setInterval(() => {
    updateRainbowSpanColors();
  }, 16);
}

export function badgeSpoofHook() {
  startRainbowLoop();

  if (!nameSyncMonitorStarted) {
    nameSyncMonitorStarted = true;
    setInterval(() => {
      applySpoofsNow();
      syncDisplayNameUI();
    }, 120);
  }

  if (!configWatcherStarted) {
    configWatcherStarted = true;
    sketchConfig.configTarget.addEventListener("change", () => {
      applySpoofsNow();
      refreshGameUI();
    });
  }

  if (!monitorStarted) {
    monitorStarted = true;

    // Install locks immediately when the local player object is created.
    onPlayerAddHooks.push((player) => {
      if ((player as AnyObj)?.isYou) {
        installLocks(player);
        forceApplySpoofs(player);
      }
    });

    onGameHooks.push(() => {
      // Apply spoofs every render frame so server packets can't desync them.
      // refreshGameUI is intentionally NOT called here — it rebuilds DOM every frame and tanks perf.
      overlayRenderHooks.push(() => {
        applySpoofsNow();
      });
    });
  }

  inputHooks.push(() => {
    let player: Player;

    try {
      player = getLocalPlayer();
    } catch {
      return;
    }

    installLocks(player);
    forceApplySpoofs(player);
    syncDisplayNameUI();
  });

  // Apply once right away so toggles/text changes are reflected without waiting for game updates.
  applySpoofsNow();
}

export function BadgeSpoofMenu() {
  const [badgeSpoofVerified, setBadgeSpoofVerified] = useSketchConfig(
    "badgeSpoofVerified",
  );
  const [badgeSpoofHideEndScreen, setBadgeSpoofHideEndScreen] = useSketchConfig(
    "badgeSpoofHideEndScreen",
  );
  const [badgeRainbow, setBadgeRainbow] = useSketchConfig("badgeRainbow");
  const [fakeClanTagEnabled, setFakeClanTagEnabled] = useSketchConfig(
    "fakeClanTagEnabled",
  );
  const [fakeClanTag, setFakeClanTag] = useSketchConfig("fakeClanTag");
  const [displayNameSpoofEnabled, setDisplayNameSpoofEnabled] = useSketchConfig(
    "displayNameSpoofEnabled",
  );
  const [displayNameSpoof, setDisplayNameSpoof] = useSketchConfig(
    "displayNameSpoof",
  );
  const [fakePremiumEnabled, setFakePremiumEnabled] = useSketchConfig(
    "fakePremiumEnabled",
  );
  const [fakeVipStatusEnabled, setFakeVipStatusEnabled] = useSketchConfig(
    "fakeVipStatusEnabled",
  );

  return (
    <>
      <Switch
        title="Spoof Verified"
        description="Forces verified badge/account flags on local and menu player"
        defaultChecked={badgeSpoofVerified}
        onChange={(event) => {
          setBadgeSpoofVerified(event.currentTarget.checked);
          applySpoofsNow();
        }}
      />
      <Switch
        title="Hide All Spoofs on End Screen"
        description="Disables all spoofs (badge, clan tag, display name, RGB) during the end-of-game scoreboard"
        defaultChecked={badgeSpoofHideEndScreen}
        onChange={(event) => {
          setBadgeSpoofHideEndScreen(event.currentTarget.checked);
          applySpoofsNow();
        }}
      />
      <Switch
        title="Rainbow Clan Tag"
        description="Cycles your clan tag text color through RGB"
        defaultChecked={badgeRainbow}
        onChange={(event) => {
          setBadgeRainbow(event.currentTarget.checked);
          applySpoofsNow();
        }}
      />
      <Switch
        title="Fake Clan Tag"
        description="Overrides your displayed clan tag"
        defaultChecked={fakeClanTagEnabled}
        onChange={(event) => {
          setFakeClanTagEnabled(event.currentTarget.checked);
          applySpoofsNow();
        }}
      />
      <Text
        title="Clan Tag Text"
        description="Displayed when Fake Clan Tag is enabled"
        placeholder="DEV"
        defaultValue={fakeClanTag}
        onChange={(event) => {
          setFakeClanTag(event.currentTarget.value);
          applySpoofsNow();
        }}
      />
      <Switch
        title="Fake Display Name"
        description="Overrides your displayed player name"
        defaultChecked={displayNameSpoofEnabled}
        onChange={(event) => {
          setDisplayNameSpoofEnabled(event.currentTarget.checked);
          applySpoofsNow();
        }}
      />
      <Switch
        title="Fake Premium"
        description="Forces premiumT on local/menu account"
        defaultChecked={fakePremiumEnabled}
        onChange={(event) => {
          setFakePremiumEnabled(event.currentTarget.checked);
          applySpoofsNow();
          queueGameUIRefresh();
        }}
      />
      <Switch
        title="Fake VIP Status"
        description="Forces VIP tier status via BP tier"
        defaultChecked={fakeVipStatusEnabled}
        onChange={(event) => {
          setFakeVipStatusEnabled(event.currentTarget.checked);
          applySpoofsNow();
          queueGameUIRefresh();
        }}
      />
      <Text
        title="Display Name Text"
        description="Displayed when Fake Display Name is enabled"
        placeholder="DEV"
        defaultValue={displayNameSpoof}
        onChange={(event) => {
          setDisplayNameSpoof(event.currentTarget.value);
          applySpoofsNow();
          queueGameUIRefresh();
        }}
      />
    </>
  );
}
