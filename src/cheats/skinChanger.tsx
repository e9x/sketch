import { getGame, getMenuPlayer, onGameHooks } from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { HeadlessSet, Set } from "../krunker-ui/components/Set";
import { Select } from "../krunker-ui/components/Select";
import { Switch } from "../krunker-ui/components/Switch";
import { Button } from "../krunker-ui/components/Button";
import { SkinHackMenu } from "./skins";
import type { Player } from "../krunker/Player";
import { useState, useEffect, useCallback } from "preact/hooks";

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

// Weapon skin slots use the WEAPON type but are filtered by weapon ID
// skins[i].weapon is 1-indexed (weapon 1 = getGame().weapons[0])
const WEAPON_SKIN_KEY_PREFIX = "weaponSkin_";
// Charm slots per weapon
const CHARM_KEY_PREFIX = "charm_";

type SkinEntry = { id: number; name: string; type: number; weapon?: number; classIndex?: number };

let cachedSkins: SkinEntry[] = [];
let cachedWeapons: { name: string }[] = [];

function ensureCache() {
  if (cachedSkins.length > 0) return;
  try {
    const game = getGame();
    cachedSkins = game.store.skins as SkinEntry[];
    cachedWeapons = game.weapons as { name: string }[];
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
 * Force regen meshes on the local player with current skin overrides.
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
      game.players.regenMeshes(menu);
    }
  } catch {}
}

// --- UI ---

function SlotDropdown({
  label,
  slotKey,
  options,
  onChanged,
}: {
  label: string;
  slotKey: string;
  options: { index: number; name: string }[];
  onChanged: () => void;
}) {
  const currentVal = getSlotValue(slotKey);

  return (
    <Select
      title={label}
      defaultValue={String(currentVal)}
      onChange={(e) => {
        const val = parseInt(e.currentTarget.value);
        setSlotValue(slotKey, val);
        onChanged();
      }}
    >
      <option value="-1">Default</option>
      {options.map((o) => (
        <option key={o.index} value={String(o.index)}>
          {o.name}
        </option>
      ))}
    </Select>
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
        <SkinHackMenu />
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
      <SkinHackMenu />
      <Switch
        title="Enable Skin Changer"
        description="Override your cosmetics and weapon skins client-side. Only visible to you."
        defaultChecked={enabled}
        onChange={(e) => {
          const on = e.currentTarget.checked;
          setEnabled(on);
          if (on) regenLocalPlayerMeshes();
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

          <Set title="Cosmetics">
            {COSMETIC_SLOTS.map((slot) => (
              <SlotDropdown
                key={slot.key}
                label={slot.label}
                slotKey={slot.key}
                options={getSkinsForType(slot.type)}
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
                <SlotDropdown
                  key={`ws_${i}`}
                  label={w.name}
                  slotKey={`${WEAPON_SKIN_KEY_PREFIX}${i}`}
                  options={skins}
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
                <SlotDropdown
                  key={`ch_${i}`}
                  label={w.name}
                  slotKey={`${CHARM_KEY_PREFIX}${i}`}
                  options={charms}
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
