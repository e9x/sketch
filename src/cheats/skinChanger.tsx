import { getGame, getMenuPlayer, innerHTMLHooks, onGameHooks } from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { Set } from "../krunker-ui/components/Set";
import { Select } from "../krunker-ui/components/Select";
import { Switch } from "../krunker-ui/components/Switch";
import { Button } from "../krunker-ui/components/Button";
import { Control } from "../krunker-ui/components/Control";
import { ColorPicker } from "../krunker-ui/components/ColorPicker";
import { createRenderContainer } from "../krunker-ui/container";
import { isDevelopment } from "../consts";
import { console } from "../crashout";
import type { Player } from "../krunker/Player";
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { RarityEntry, SkinEntry } from "../krunker/Game";

// Skin type indices per the game's store.types array
const SKIN_TYPE = {
  WEAPON: 0,
  HAT: 1,
  BODY: 2,
  MELEE: 3,
  SPRAY: 4,
  DYE: 5,
  WAIST: 6,
  FACE: 7,
  SHOE: 8,
  PET: 9,
  COLLECTIBLE: 10,
  WRIST: 11,
  CHARM: 12,
  TICKET: 13,
  BACK: 14,
  HEAD: 15,
  PLAYER_CARD: 16,
  EMOJI: 17,
} as const;

// Maps player property names to skin type indices
// These are the cosmetic slots we can override on a player
const COSMETIC_SLOTS = [
  { key: "hatIndex", type: SKIN_TYPE.HAT, label: "Hat" },
  { key: "headIndex", type: SKIN_TYPE.HEAD, label: "Head" },
  { key: "faceIndex", type: SKIN_TYPE.FACE, label: "Face" },
  { key: "bodyIndex", type: SKIN_TYPE.BODY, label: "Body" },
  { key: "dyeIndex", type: SKIN_TYPE.DYE, label: "Dye" },
  { key: "backIndex", type: SKIN_TYPE.BACK, label: "Back" },
  { key: "waistIndex", type: SKIN_TYPE.WAIST, label: "Waist" },
  { key: "shoeIndex", type: SKIN_TYPE.SHOE, label: "Shoe" },
  { key: "petIndex", type: SKIN_TYPE.PET, label: "Pet" },
  { key: "wristIndex", type: SKIN_TYPE.WRIST, label: "Wrist" },
  { key: "meleeIndex", type: SKIN_TYPE.MELEE, label: "Melee" },
] as const;

// Skin color options matching the game's skinColors array
const SKIN_COLORS = [
  { index: 0, name: "Bronze" },
  { index: 1, name: "Sienna" },
  { index: 2, name: "Rose" },
  { index: 3, name: "Tan" },
  { index: 4, name: "Pale" },
  { index: 5, name: "Infected" },
  { index: 6, name: "Yellowish" },
  { index: 7, name: "Darker Color" },
] as const;

// Integer color values from the game's skinColors array
const SKIN_COLOR_VALUES = [
  8412234, // Bronze
  10975328, // Sienna
  13864303, // Rose
  13408638, // Tan
  15581094, // Pale
  8492161, // Infected
  14919767, // Yellowish
  2492161, // Darker Color
] as const;

// Weapon skin slots use the WEAPON type but are filtered by weapon ID
// skins[i].weapon is 1-indexed (weapon 1 = getGame().weapons[0])
const WEAPON_SKIN_KEY_PREFIX = "weaponSkin_";
// Charm slots per weapon
const CHARM_KEY_PREFIX = "charm_";

let cachedSkins: SkinEntry[] = [];
let cachedWeapons: { name: string }[] = [];
let cachedRarities: RarityEntry[] = [];

function ensureCache() {
  if (cachedSkins.length > 0) return;
  try {
    const game = getGame();
    cachedSkins = game.store.skins as SkinEntry[];
    cachedWeapons = game.weapons as { name: string }[];
    cachedRarities = game.store.rarities as RarityEntry[];
  } catch {}
}

/**
 * Get skins filtered by type (and optionally weapon index for weapon skins).
 * weaponId is 1-indexed (matching skin.weapon).
 */
function getSkinsForType(type: number, weaponId?: number): { index: number; name: string }[] {
  ensureCache();
  const results: { index: number; name: string }[] = [];
  for (let i = 0; i < cachedSkins.length; i++) {
    const s = cachedSkins[i];
    if (!s) continue;
    // weapon skins have type 0/undefined/null (all falsy)
    const skinType = s.type || 0;
    if (skinType !== type) continue;
    if (weaponId !== undefined && s.weapon !== weaponId) continue;
    results.push({ index: i, name: s.name || `Skin #${i}` });
  }
  // Sort by rarity descending (rarest first), then by name
  results.sort((a, b) => {
    const ra = cachedSkins[a.index]?.rarity || 0;
    const rb = cachedSkins[b.index]?.rarity || 0;
    if (rb !== ra) return rb - ra;
    return a.name.localeCompare(b.name);
  });
  return results;
}

function getSlotValue(key: string): number {
  return sketchConfig.get("skinChangerSlots")[key] ?? -1;
}

function setSlotValue(key: string, value: number) {
  const slots = { ...sketchConfig.get("skinChangerSlots") };
  if (value === -1) {
    delete slots[key];
  } else {
    slots[key] = value;
  }
  sketchConfig.set("skinChangerSlots", slots);
}

/**
 * Apply the skin changer overrides to a player object.
 * Mutates the player's index properties in-place.
 * Returns true if any changes were made.
 */
export function applySkinOverrides(player: Player): boolean {
  if (!sketchConfig.get("skinChanger")) return false;
  const menuPlayer = getMenuPlayer();
  if (!player.isYou && player !== menuPlayer) return false;

  const slots = sketchConfig.get("skinChangerSlots");
  let changed = false;

  for (const slot of COSMETIC_SLOTS) {
    const val = slots[slot.key];
    if (val !== undefined && val !== -1) {
      if ((player as any)[slot.key] !== val) {
        (player as any)[slot.key] = val;
        changed = true;
      }
    }
  }

  // Skin color
  const skinColVal = slots["skinColIndex"];
  if (skinColVal !== undefined && skinColVal !== -1) {
    if ((player as any).skinColIndex !== skinColVal) {
      (player as any).skinColIndex = skinColVal;
      changed = true;
    }
  }

  // Hair color
  const hairCol = sketchConfig.get("skinChangerHairCol");
  if (hairCol) {
    if ((player as any).hairCol !== hairCol) {
      (player as any).hairCol = hairCol;
      changed = true;
    }
  }

  // Weapon skins - stored in player.skins[] array
  // player.skins is indexed by weapon ID (0-indexed)
  // The skin value is the skin index from store.skins
  if (player.skins) {
    for (const key in slots) {
      if (key.startsWith(WEAPON_SKIN_KEY_PREFIX)) {
        const weaponIdx = parseInt(key.slice(WEAPON_SKIN_KEY_PREFIX.length));
        if (!isNaN(weaponIdx) && slots[key] !== -1) {
          if (player.skins[weaponIdx] !== slots[key]) {
            player.skins[weaponIdx] = slots[key];
            changed = true;
          }
        }
      }
      if (key.startsWith(CHARM_KEY_PREFIX)) {
        const weaponIdx = parseInt(key.slice(CHARM_KEY_PREFIX.length));
        if (!isNaN(weaponIdx) && player.charms && slots[key] !== -1) {
          if (player.charms[weaponIdx] !== slots[key]) {
            player.charms[weaponIdx] = slots[key];
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

/**
 * Hook into generateMeshes to apply skin overrides before meshes are built.
 */
export function skinChangerHook() {
  onGameHooks.push(() => {
    ensureCache();

    const game = getGame();
    const { generateMeshes } = game.players;

    game.players.generateMeshes = function (
      this: typeof game.players,
      plr: Player,
      ...args: unknown[]
    ) {
      applySkinOverrides(plr);
      return generateMeshes.call(this, plr, ...args);
    } as typeof generateMeshes;
  });
}

/**
 * Hook the class preview UI text (menuClassSubtext) so it displays
 * the overridden skin's name, rarity color and thumbnail instead of
 * the player's real equipped skin.
 */
export function skinChangerClassPreviewHook() {
  let updating = false;

  innerHTMLHooks.push((element) => {
    if (updating) return;
    if (element.id !== "menuClassSubtext") return;
    if (!sketchConfig.get("skinChanger")) return;

    ensureCache();
    if (cachedSkins.length === 0 || cachedRarities.length === 0) return;

    let game: ReturnType<typeof getGame>;
    try {
      game = getGame();
    } catch {
      return;
    }
    const slots = sketchConfig.get("skinChangerSlots");
    const weapons = game.weapons;
    if (!weapons) return;

    // Figure out which class is selected by reading the current loadout.
    let classConfig: { loadout: number[] } | undefined;
    try {
      const menuPlr = getMenuPlayer();
      if (menuPlr) {
        classConfig = game.classConfig[menuPlr.classIndex];
      }
    } catch {}
    if (!classConfig) return;

    const loadout = classConfig.loadout;
    if (!loadout?.length) return;

    // Only override if at least one weapon skin slot is active.
    let hasOverride = false;
    for (const weaponIdx of loadout) {
      const slotKey = `${WEAPON_SKIN_KEY_PREFIX}${weaponIdx}`;
      if ((slots[slotKey] ?? -1) >= 0) {
        hasOverride = true;
        break;
      }
    }
    if (!hasOverride) return;

    let html = "";
    let lastThumbnail = "";

    for (let wi = 0; wi < loadout.length; wi++) {
      const weaponIdx = loadout[wi];
      const weapon = weapons[weaponIdx];
      if (!weapon) continue;

      if (html) html += " - ";

      const slotKey = `${WEAPON_SKIN_KEY_PREFIX}${weaponIdx}`;
      const overrideSkinIdx = slots[slotKey] ?? -1;

      let color = "inherit";
      let animate = false;

      if (overrideSkinIdx >= 0) {
        const skin = cachedSkins[overrideSkinIdx];
        if (skin) {
          const rarity = cachedRarities[skin.rarity || 0];
          if (rarity) {
            color = rarity.color || color;
            animate = !!rarity.animate;
          }
          if (skin.thumbnail) lastThumbnail = skin.thumbnail;
        }
      }

      html += `<span ${animate ? "class='rainbowText' " : ""}style='color:${color}'>${weapon.name}</span>`;
    }

    if (html) {
      updating = true;
      element.innerHTML = html;
      updating = false;
    }

    if (lastThumbnail) {
      const iconEl = document.getElementById("menuClassIcn") as HTMLImageElement | null;
      if (iconEl) iconEl.src = lastThumbnail;
    }
  });
}

/**
 * Force regen meshes on the local player with current skin overrides.
 * For the menu preview player, we set needsRender = true and let the game's
 * own preview render loop rebuild the meshes in the correct scene.
 */
export function regenLocalPlayerMeshes() {
  try {
    const game = getGame();
    const local = game.players.list.find((p) => p.isYou);
    if (local) {
      applySkinOverrides(local);
      game.players.regenMeshes(local);
    }
    const menu = getMenuPlayer();
    if (menu) {
      applySkinOverrides(menu);
      menu.needsRender = true;
    }
  } catch {}
}

// --- UI ---

let skinChangerWindowIndex: number | null = null;

/**
 * Open the skin changer as its own game popup window.
 */
export function openSkinChangerWindow() {
  const html = createRenderContainer(() => <SkinChangerMenu />);

  const win: GameWindowRender = {
    header: "Skin Changer",
    label: "skinchanger",
    width: 900,
    height: "100%",
    popup: true,
    sticky: true,
    forceScroll: true,
    gen: () => html,
  };

  if (skinChangerWindowIndex === null) {
    skinChangerWindowIndex = windows.length;
    windows.push(win);
  } else {
    windows[skinChangerWindowIndex] = win;
  }

  try {
    showWindow(skinChangerWindowIndex + 1);
  } catch (err) {
    if (isDevelopment) console.error("show skin changer win", err);
  }
}

// --- Skin Picker Popup ---

let pickerState: {
  slotKey: string;
  type: number;
  label: string;
  weaponId?: number;
} | null = null;
let pickerOnSelect: ((index: number) => void) | null = null;
let skinPickerWindowIndex: number | null = null;

function openSkinPicker(
  slotKey: string,
  type: number,
  label: string,
  onSelect: (index: number) => void,
  weaponId?: number,
) {
  pickerState = { slotKey, type, label, weaponId };
  pickerOnSelect = onSelect;

  const html = createRenderContainer(() => <SkinPickerPopup />);

  const win: GameWindowRender = {
    header: `Select ${label}`,
    label: "skinpicker",
    width: 877,
    height: "calc(100% - 300px)",
    sticky: true,
    dark: true,
    hideScroll: true,
    gen: () => html,
  };

  if (skinPickerWindowIndex === null) {
    skinPickerWindowIndex = windows.length;
    windows.push(win);
  } else {
    windows[skinPickerWindowIndex] = win;
  }

  try {
    showWindow(skinPickerWindowIndex + 1);
  } catch (err) {
    if (isDevelopment) console.error("show skin picker win", err);
  }
}

function SkinPickerPopup() {
  const state = pickerState;
  if (!state) return null;

  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allSkins = getSkinsForType(state.type, state.weaponId);

  const filtered = search
    ? allSkins.filter((s) => {
        const skin = cachedSkins[s.index];
        if (!skin) return false;
        const q = search.toLowerCase();
        if (skin.name?.toLowerCase().includes(q)) return true;
        if (skin.keyW?.toLowerCase().includes(q)) return true;
        if (skin.creator?.toLowerCase().includes(q)) return true;
        if (skin.creators) {
          for (const c of skin.creators) {
            if (c.toLowerCase().includes(q)) return true;
          }
        }
        return false;
      })
    : allSkins;

  function select(index: number) {
    pickerOnSelect?.(index);
    if (skinChangerWindowIndex !== null) {
      showWindow(skinChangerWindowIndex + 1);
    }
  }

  function goBack() {
    if (skinChangerWindowIndex !== null) {
      showWindow(skinChangerWindowIndex + 1);
    } else {
      closWind();
    }
  }

  const imgClass = state.type ? "skinImgC" : "skinImg";

  return (
    <>
      <div id="itemSearchH">
        <div class="custBack" onClick={goBack} onMouseEnter={() => playTick()}>
          <span class="material-icons custBackArr">arrow_back</span>
        </div>
        <input
          ref={inputRef}
          id="itemSearch"
          type="text"
          placeholder="Search Item"
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
        <div
          class="winClose"
          onClick={() => closWind()}
          onMouseEnter={() => playTick()}
        >
          <span class="material-icons winCloseArr">close</span>
        </div>
      </div>
      <div
        id="skinList"
        style="margin-top: 8px; overflow-y: scroll; height: calc(100% - 95px);"
      >
        {/* Default / None */}
        <div
          class="skinCard blackShad"
          style="border: 5px solid lightgrey"
          onMouseEnter={() => playTick()}
          onClick={() => select(-1)}
        >
          None
          <div class="itemOwn">Default</div>
          <div class="itemSea" style="opacity: 0">
            Season 1
          </div>
        </div>

        {/* Skin cards */}
        {filtered.map((s) => {
          const skin = cachedSkins[s.index];
          if (!skin) return null;
          const rarity = cachedRarities[skin.rarity || 0];
          const color = rarity?.color || "lightgrey";
          const isAnimated =
            !skin.free && rarity?.animate;

          return (
            <div
              key={s.index}
              class={`skinCard${skin.rarity !== 5 ? " blackShad" : ""}${isAnimated ? " rainbow" : ""}`}
              style={
                skin.free
                  ? "border: 5px solid lightgrey"
                  : `color: ${color}; border: 5px solid ${color}`
              }
              onMouseEnter={() => playTick()}
              onClick={() => select(s.index)}
              data-index={skin.index}
            >
              {skin.name}
              <div class="itemOwn" style="z-index: 3; position: relative;">
                {skin.free
                  ? "Default"
                  : `by ${skin.creator || "Krunker.io"}`}
              </div>
              {!skin.free && (
                <div class="itemSea">Season {skin.seas || 1}</div>
              )}
              {skin.thumbnail && (
                <img
                  loading="lazy"
                  draggable={false}
                  class={`${imgClass}${skin.rgb ? " rgbHue" : ""}`}
                  src={skin.thumbnail}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// --- Slot Picker Button ---

function SlotPicker({
  label,
  slotKey,
  type,
  onChanged,
  weaponId,
}: {
  label: string;
  slotKey: string;
  type: number;
  onChanged: () => void;
  weaponId?: number;
}) {
  const currentVal = getSlotValue(slotKey);
  const currentSkin = currentVal >= 0 ? cachedSkins[currentVal] : null;

  return (
    <Control title={label} description={currentSkin ? currentSkin.name : "Default"}>
      <div className="settingsBtn" style={{ width: "auto", flexShrink: 0 }} onClick={() => {
        const skins = getSkinsForType(type, weaponId);
        if (skins.length === 0) return;
        const picked = skins[Math.floor(Math.random() * skins.length)];
        setSlotValue(slotKey, picked.index);
        onChanged();
      }}>
        Random
      </div>
      <div className="settingsBtn" style={{ width: "auto", flexShrink: 0, marginLeft: "5px" }} onClick={() => {
        openSkinPicker(slotKey, type, label, (index) => {
          setSlotValue(slotKey, index);
          onChanged();
        }, weaponId);
      }}>
        Browse
      </div>
    </Control>
  );
}

export function SkinChangerMenu() {
  const [enabled, setEnabled] = useSketchConfig("skinChanger");
  const [, setSlots] = useSketchConfig("skinChangerSlots");
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      ensureCache();
      if (cachedSkins.length > 0) setReady(true);
    } catch {}

    // Retry until game is loaded
    if (!ready) {
      const id = setInterval(() => {
        try {
          ensureCache();
          if (cachedSkins.length > 0) {
            setReady(true);
            clearInterval(id);
          }
        } catch {}
      }, 1000);
      return () => clearInterval(id);
    }
  }, [ready]);

  const onChanged = useCallback(() => {
    setRevision((r) => r + 1);
    if (enabled) regenLocalPlayerMeshes();
  }, [enabled]);

  if (!ready) {
    return (
      <Set title="Skin Changer">
        <Switch
          title="Enable Skin Changer"
          description="Override your cosmetics client-side. Waiting for game to load..."
          defaultChecked={enabled}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />
      </Set>
    );
  }

  const weapons = cachedWeapons;

  return (
    <Set title="Skin Changer">
      <Switch
        title="Enable Skin Changer"
        description="Override your cosmetics and weapon skins client-side. Only visible to you."
        defaultChecked={enabled}
        onChange={(e) => {
          const on = e.currentTarget.checked;
          setEnabled(on);
          regenLocalPlayerMeshes();
        }}
      />
      {enabled && (
        <>
          <Button
            title="Reset All"
            text="Reset"
            onClick={() => {
              setSlots({});
              setRevision((r) => r + 1);
              regenLocalPlayerMeshes();
            }}
          />

          <Set title="Colors">
            <Select
              title="Skin Color Preset"
              defaultValue={String(getSlotValue("skinColIndex"))}
              onChange={(e) => {
                const val = parseInt(e.currentTarget.value);
                setSlotValue("skinColIndex", val);
                onChanged();
              }}
            >
              <option value="-1">Default</option>
              {SKIN_COLORS.map((c) => (
                <option key={c.index} value={String(c.index)}>
                  {c.name}
                </option>
              ))}
            </Select>
            <ColorPicker
              title="Skin Color"
              defaultValue={(() => {
                const v = getSlotValue("skinColIndex");
                if (v <= -1) return "#806a4a";
                if (v <= 7) {
                  const col = SKIN_COLOR_VALUES[v];
                  return col ? `#${col.toString(16).padStart(6, "0")}` : "#806a4a";
                }
                return `#${v.toString(16).padStart(6, "0")}`;
              })()}
              onChange={(e) => {
                const hex = e.currentTarget.value;
                const intCol = parseInt(hex.slice(1), 16);
                setSlotValue("skinColIndex", intCol);
                onChanged();
              }}
            />
            <Button
              title="Reset Skin Color"
              text="Reset"
              onClick={() => {
                setSlotValue("skinColIndex", -1);
                onChanged();
              }}
            />
            <ColorPicker
              title="Hair Color"
              defaultValue={sketchConfig.get("skinChangerHairCol") || "#000000"}
              onChange={(e) => {
                sketchConfig.set("skinChangerHairCol", e.currentTarget.value);
                onChanged();
              }}
            />
            <Button
              title="Reset Hair Color"
              text="Reset"
              onClick={() => {
                sketchConfig.set("skinChangerHairCol", "");
                onChanged();
              }}
            />
          </Set>

          <Set title="Cosmetics">
            {COSMETIC_SLOTS.map((slot) => (
              <SlotPicker
                key={slot.key}
                label={slot.label}
                slotKey={slot.key}
                type={slot.type}
                onChanged={onChanged}
              />
            ))}
          </Set>

          <Set title="Weapon Skins">
            {weapons.map((w, i) => {
              const weaponId = i + 1; // skins use 1-indexed weapon
              const skins = getSkinsForType(SKIN_TYPE.WEAPON, weaponId);
              if (skins.length === 0) return null;
              return (
                <SlotPicker
                  key={`ws_${i}`}
                  label={w.name}
                  slotKey={`${WEAPON_SKIN_KEY_PREFIX}${i}`}
                  type={SKIN_TYPE.WEAPON}
                  weaponId={weaponId}
                  onChanged={onChanged}
                />
              );
            })}
          </Set>

          <Set title="Charms">
            {weapons.map((w, i) => {
              const charms = getSkinsForType(SKIN_TYPE.CHARM);
              if (charms.length === 0) return null;
              return (
                <SlotPicker
                  key={`ch_${i}`}
                  label={w.name}
                  slotKey={`${CHARM_KEY_PREFIX}${i}`}
                  type={SKIN_TYPE.CHARM}
                  onChanged={onChanged}
                />
              );
            })}
          </Set>
        </>
      )}
    </Set>
  );
}
