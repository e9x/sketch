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
const randomSuffix = Math.random().toString(36).slice(2, 10);
const rainbowMarkerAttr = `data-r_${randomSuffix}`;
let lastRainbowTag = "";

type AnyObj = Record<PropertyKey, any>;

function refreshGameUI() {
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

function installLocks(player: Player) {
  const p = player as AnyObj;
  const fakeClanEnabled = () => sketchConfig.get("fakeClanTagEnabled");
  const fakeClanValue = () => sketchConfig.get("fakeClanTag").trim();
  const fakeClanActive = () => fakeClanEnabled() && fakeClanValue().length > 0;
  const fakeNameEnabled = () => sketchConfig.get("displayNameSpoofEnabled");
  const fakeNameValue = () => sketchConfig.get("displayNameSpoof").trim();
  const fakeNameActive = () => fakeNameEnabled() && fakeNameValue().length > 0;
  const verifiedActive = () =>
    sketchConfig.get("badgeSpoofVerified") &&
    !(sketchConfig.get("badgeSpoofHideEndScreen") && isOnEndScreen());

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

    defineSpoofedProperty(p, "clan", () => fakeClanValue(), () => fakeClanActive());
    defineSpoofedProperty(p, "name", () => fakeNameValue(), () => fakeNameActive());
    defineSpoofedProperty(p, "alias", () => fakeNameValue(), () => fakeNameActive());
    defineSpoofedProperty(
      p,
      "fakeName",
      () => fakeNameValue(),
      () => fakeNameActive(),
    );
    defineSpoofedProperty(
      p,
      "getName",
      () => () => fakeNameValue(),
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

  if (sketchConfig.get("badgeSpoofVerified") && !(sketchConfig.get("badgeSpoofHideEndScreen") && isOnEndScreen())) {
    (player as AnyObj).featured = 1;
    (player as AnyObj).emailVerified = true;
    if (account) {
      account.featured = 1;
      account.emailVerified = true;
    }
  }

  if (sketchConfig.get("fakeClanTagEnabled")) {
    const tag = sketchConfig.get("fakeClanTag").trim();
    if (tag) {
      (player as AnyObj).clan = tag;
      if (account) account.clan = tag;
    }
  }

  if (sketchConfig.get("displayNameSpoofEnabled")) {
    const displayName = sketchConfig.get("displayNameSpoof").trim();
    if (displayName) {
      (player as AnyObj).name = displayName;
      (player as AnyObj).alias = displayName;
      (player as AnyObj).fakeName = displayName;
      if (typeof (player as AnyObj).getName === "function") {
        (player as AnyObj).getName = () => displayName;
      }
      if (account) {
        account.name = displayName;
        account.alias = displayName;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updateRainbowSpanColors() {
  const spans = document.querySelectorAll<HTMLElement>(
    `span[${rainbowMarkerAttr}="1"]`,
  );
  if (!spans.length) return;

  const now = Date.now();
  const cycleMs = 4800;

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const hue = (((now + i * 180) % cycleMs) / cycleMs) * 360;
    span.style.setProperty("color", `hsl(${hue.toFixed(1)} 96% 62%)`, "important");
  }
}

function clearClanRainbowSpans() {
  const nodes = document.querySelectorAll(`span[${rainbowMarkerAttr}="1"]`);
  for (const node of nodes) {
    const text = document.createTextNode(node.textContent || "");
    node.replaceWith(text);
  }
}

function updateRainbowBadges() {
  const enabled = sketchConfig.get("badgeRainbow");
  const fakeTag = sketchConfig.get("fakeClanTag").trim();

  if (!enabled || !fakeTag) {
    clearClanRainbowSpans();
    lastRainbowTag = "";
    return;
  }

  if (lastRainbowTag && lastRainbowTag.toLowerCase() !== fakeTag.toLowerCase()) {
    clearClanRainbowSpans();
  }
  lastRainbowTag = fakeTag;

  const root = document.body || document.documentElement;
  if (!root) return;

  const tagPattern = new RegExp(`\\[${escapeRegExp(fakeTag)}\\]`, "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    const text = textNode.nodeValue || "";

    if (
      parent &&
      !parent.closest(`[${rainbowMarkerAttr}="1"]`) &&
      parent.tagName !== "SCRIPT" &&
      parent.tagName !== "STYLE" &&
      tagPattern.test(text)
    ) {
      textNodes.push(textNode);
    }

    tagPattern.lastIndex = 0;
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue || "";
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    text.replace(tagPattern, (match, offset: number) => {
      if (offset > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
      }

      const span = document.createElement("span");
      span.setAttribute(rainbowMarkerAttr, "1");
      span.style.display = "inline-block";
      span.textContent = match;
      fragment.appendChild(span);

      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.replaceWith(fragment);
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

  setInterval(() => {
    queueRainbowRefresh();
    updateRainbowSpanColors();
  }, 16);
}

export function badgeSpoofHook() {
  startRainbowLoop();

  if (!configWatcherStarted) {
    configWatcherStarted = true;
    // Runs every overlay render frame — no interval needed for in-game realtime.
    // Config change listener only needed for menu player (before localPlayer exists).
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
      // Apply and refresh visible UI every render frame so server packets can't desync the spoof.
      overlayRenderHooks.push(() => {
        applySpoofsNow();
        refreshGameUI();
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
        title="Hide Badge on End Screen"
        description="Disables the verified spoof during the end-of-game scoreboard"
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
      <Text
        title="Display Name Text"
        description="Displayed when Fake Display Name is enabled"
        placeholder="DEV"
        defaultValue={displayNameSpoof}
        onChange={(event) => {
          setDisplayNameSpoof(event.currentTarget.value);
          applySpoofsNow();
        }}
      />
    </>
  );
}
