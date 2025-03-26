import { AdblockMenu } from "../cheats/adblock";
import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { ESPMenu } from "../cheats/esp";
import { KeybindOverlayMenu } from "../cheats/keybindOverlay";
import { SkinHackMenu } from "../cheats/skins";
import { WatermarkMenu } from "../cheats/watermark";
import { discordURL, docsURL, sketchVersion } from "../consts";
import { getGame, getLocalPlayer, redrawSky } from "../filters";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import { updateSketchMenuButton } from "./createUI";
import { BindHolder, Bind } from "../krunker-ui/components/Bind";
import { ColorPicker } from "../krunker-ui/components/ColorPicker";
import { Control } from "../krunker-ui/components/Control";
import { Link } from "../krunker-ui/components/Link";
import { HeadlessSet, Set } from "../krunker-ui/components/Set";
import { Switch } from "../krunker-ui/components/Switch";
import { Settings } from "../krunker-ui/settings";
import { Text } from "../krunker-ui/components/Text";

function downloadFile(fileName: string, fileData: string) {
  const downloadLink = document.createElement("a");
  downloadLink.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(fileData)
  );
  downloadLink.setAttribute("download", fileName);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

function pickFile() {
  return new Promise<string>((resolve, reject) => {
    // Create an HTML file picker input element
    const filePicker = document.createElement("input");
    filePicker.type = "file";
    filePicker.accept = ".json";
    filePicker.style.display = "none";
    filePicker.addEventListener("change", handleFileSelect);

    // Add the file picker input to the DOM
    document.documentElement.appendChild(filePicker);

    // Click the file picker input to open the file selection dialog
    filePicker.click();

    // Handle the file selection
    function handleFileSelect(event: Event) {
      const target = event.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) {
        reject(new Error("No file selected"));
        return;
      }

      // Read the contents of the selected file as text
      const file = target.files[0];
      const reader = new FileReader();

      reader.addEventListener("load", (event) => {
        const contents = event.target?.result as string;
        resolve(contents);
      });

      reader.addEventListener("error", (event) => {
        reject(event.target?.error || new Error("Failed to read file"));
      });

      reader.readAsText(file);

      // Clean up after finishing
      filePicker.removeEventListener("change", handleFileSelect);
      filePicker.remove();
    }
  });
}

let defaultTabID: number | undefined;

export default function Menu() {
  const [menuKey, setMenuKey] = useSketchConfig("menuKey");
  const [menuButton] = useSketchConfig("menuButton");
  const [noAdsFovMlt, setNoAdsFovMlt] = useSketchConfig("noAdsFovMlt");
  const [silentFail, setSilentFail] = useSketchConfig("silentFail");
  const [thirdPerson, setThirdPerson] = useSketchConfig("thirdPerson");
  const [skyColor, setSkyColor] = useSketchConfig("skyColor");
  const [skyColorHex, setSkyColorHex] = useSketchConfig("skyColorHex");
  const [mapOverrides, setMapOverrides] = useSketchConfig("mapOverrides");
  const [mapOverridesCode, setMapOverridesCode] =
    useSketchConfig("mapOverridesCode");

  return (
    <Settings
      defaultTabID={defaultTabID}
      onTabChange={(tabID) => {
        defaultTabID = tabID;
      }}
      header={
        <>
          <div
            style={{
              color: "white",
              textAlign: "center",
              padding: "30px 0",
            }}
          >
            {/*Delicious Handrawn, 4em*/}
            <svg
              viewBox="0 0 17.911 7.314"
              height="71px"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M.813 2.397q.008.96.8 1.488.192.128.4.224l.416.184q.2.08.4.184.2.096.368.232.088.064.16.144.072.08.12.184.088.2.064.384-.016.184-.128.368-.096.176-.248.312-.144.136-.312.256-.224.144-.472.24-.24.096-.512.104-.264.024-.496-.08-.2-.112-.272-.304-.064-.192.024-.392.04-.104.112-.184.072-.08.152-.152.152-.136.264-.024.12.088.048.264-.008.024-.032.056l-.032.064q-.024.056-.016.08.016.016.08.016.248.008.464-.072.176-.072.328-.168.16-.096.288-.24.112-.136.104-.208 0-.08-.152-.176-.136-.104-.296-.168l-.304-.144-.464-.208q-.232-.104-.44-.248-.272-.184-.488-.416-.216-.24-.36-.544-.176-.384-.216-.832-.016-.312.024-.624t.168-.608Q.469 1.1.653.869q.184-.24.456-.392.304-.184.68-.184.376 0 .736.352.304.272.488.616.192.336.296.728.024.096.024.2.008.104 0 .216-.008.064-.04.12-.032.056-.096.088-.128.04-.248-.072-.032-.032-.056-.072-.024-.04-.04-.072-.064-.104-.112-.216t-.104-.216q-.08-.184-.176-.36-.096-.176-.224-.328-.056-.064-.112-.12-.056-.064-.128-.104-.224-.184-.504-.048-.096.056-.184.128-.088.072-.152.168-.144.176-.224.392-.072.208-.096.44-.008.072-.024.144-.008.064 0 .12zm3.992 2.168q.048-.064.088-.128.048-.064.096-.12.144-.216.272-.44.128-.224.256-.44.024-.056.064-.096l.088-.072q.128-.064.24 0 .12.056.136.192.016.16-.04.264-.152.32-.32.624-.168.296-.4.552-.08.088-.08.112 0 .016.072.12.16.216.352.4.192.176.424.32.04.016.072.04.032.016.072.032.224.04.24.248.016.104-.048.2-.056.088-.144.128-.088.032-.184.04-.088 0-.176-.016-.336-.096-.6-.304-.112-.088-.224-.192-.104-.104-.216-.2l.016.224.016.232q.016.056.024.12t.024.12q.024.16-.096.224-.112.088-.24-.008-.104-.072-.152-.192-.056-.136-.088-.288-.032-.152-.056-.304-.064-.272-.104-.544-.04-.28-.064-.56-.032-.304-.08-.608-.04-.312-.056-.616l-.032-.448q-.016-.224-.016-.448 0-.344-.016-.688-.016-.352-.016-.696.008-.216.008-.424T3.94.509q.016-.064.024-.112.016-.048.048-.088.136-.176.336-.144.104.024.176.096.08.064.088.176.016.048.016.096v.096q.024.44.032.88.016.44.024.888.016.528.04 1.064.032.528.048 1.056 0 .04.032.048zm1.76.712q0-.376.104-.72.112-.352.288-.688.088-.16.208-.304t.272-.248q.208-.144.432-.168.24-.016.432.104t.296.328q.104.2.064.456-.008.072-.032.152t-.064.152q-.104.2-.248.384-.136.176-.336.312-.128.088-.272.152-.136.056-.296.048-.056 0-.072.016-.008.016-.008.072-.008.128.016.256t.064.256q.048.104.088.12.04.016.144-.048.152-.08.272-.216.072-.064.144-.112l.144-.112q.032-.032.096-.064.12-.04.2.024.088.056.088.184 0 .056-.008.112t-.024.112q-.104.304-.296.528-.192.224-.52.328-.456.12-.792-.216-.176-.176-.248-.392-.072-.216-.112-.448l-.016-.176q0-.096-.008-.184zm1.496-1.32q0-.056-.008-.096-.008-.048-.048-.064-.056-.032-.144.04-.032.016-.056.04l-.056.056q-.104.128-.176.28-.064.152-.12.304-.04.056.008.088.016.016.04.016.032-.008.048-.016.36-.2.504-.592.008-.016.008-.032zm2.824 2.4q.184-.136.288-.288.144-.2.28-.408.144-.208.248-.432.008-.032.016-.048.008-.024.008-.048.008-.168.192-.208.184-.016.272.136.048.056.056.12.016.056.016.128-.032.424-.224.816-.24.472-.64.784-.088.072-.184.12-.088.056-.2.08-.2.048-.4-.04-.2-.08-.32-.256-.072-.12-.128-.248-.056-.136-.096-.272-.104-.296-.152-.608t-.088-.624q-.064-.448-.096-.912-.04-.464-.04-.928 0-.088-.016-.104t-.112 0q-.104.024-.208.056-.112.024-.224.04-.136.032-.288-.04-.144-.088-.16-.24-.016-.16.096-.272.112-.096.24-.136l.288-.08q.136-.04.28-.072.096-.016.12-.032.016-.024.024-.128.008-.272.048-.536.032-.272.104-.544.032-.096.056-.192.032-.104.088-.192.048-.064.096-.112.048-.056.112-.088.152-.104.336-.016.08.056.096.136.024.08.008.168-.016.176-.064.352-.048.168-.064.352-.016.152-.04.304l-.032.312q0 .072.008.088.016.008.096.008.16 0 .304-.008t.296-.008q.272 0 .456.208.048.04.072.096.032.048.04.104.016.136-.088.24-.104.096-.216.048h-.04q-.016-.008-.04 0-.176.064-.36.056-.176-.008-.36.016h-.112q-.096 0-.096.096.016.152.016.304 0 .144.008.296.016.392.056.784t.104.776q.024.2.056.4.04.192.096.392.016.072.048.144t.064.16zm1.984-.96q-.008-.4.12-.736.136-.336.36-.632.224-.288.6-.424.152-.04.304-.024.152.008.296.096.064.048.104.104.048.056.064.128.04.2-.08.328-.12.12-.304.08-.104-.032-.184 0t-.152.104q-.512.584-.336 1.312.056.232.176.28.12.048.336-.056.152-.072.256-.216.016-.04.04-.064l.056-.056q.08-.096.192-.048.128.064.128.184.016.176-.064.32-.072.136-.184.264-.152.152-.336.24-.176.088-.384.136-.176.024-.336-.016-.152-.048-.28-.176-.16-.16-.248-.352-.08-.2-.12-.416-.016-.088-.024-.184t0-.176zm3.36-1.264q.032-.088.048-.176l.048-.192q.032-.112.08-.208.048-.096.128-.176.136-.136.312-.168t.344.072q.208.136.304.384.096.224.136.464.048.24.08.48.024.36 0 .712t-.064.704q-.008.064-.032.128-.016.056-.064.112-.04.064-.12.096-.072.032-.144 0-.136-.032-.152-.216-.032-.296-.072-.592-.032-.296-.072-.592-.032-.176-.04-.344-.008-.168-.048-.328-.032 0-.04.024l-.016.032q-.176.408-.288.832-.104.416-.144.864-.008.128-.032.256l-.032.256q-.04.256-.288.28-.096 0-.184-.08-.088-.072-.104-.184-.024-.128-.04-.248l-.016-.248-.064-.56q-.032-.288-.056-.568l-.064-.648q-.032-.328-.048-.648-.016-.288-.024-.568-.008-.28-.008-.568V1.9q.008-.32.072-.624.016-.096.04-.184.032-.096.088-.176.064-.096.16-.144.104-.048.2-.008.216.048.216.312.016.472-.016.952-.024.48-.016.952.008.288 0 .576v.576z"
                fill="#FFF"
                stroke="#FFF"
                stroke-width={0.35}
              />
            </svg>
          </div>
          <div
            style={{
              display: "inline-block",
              textAlign: "right",
              float: "right",
              height: 48, // we have to set this because we don't have the search buttons
            }}
          >
            <div className="settingsBtn" onClick={() => sketchConfig.reset()}>
              Reset
            </div>
            <div
              className="settingsBtn"
              onClick={() => {
                downloadFile(
                  "sketch.json",
                  JSON.stringify(sketchConfig.export())
                );
              }}
            >
              Export
            </div>
            <div
              className="settingsBtn"
              onClick={() =>
                pickFile().then((data) => sketchConfig.import(JSON.parse(data)))
              }
            >
              Import
            </div>
          </div>
        </>
      }
      tabs={[
        {
          name: "Menu",
          body: () => {
            return (
              <>
                <Set title="Menu">
                  <BindHolder title="Menu Key">
                    <Bind
                      bind={menuKey}
                      setBind={(bind) => {
                        if (bind === 10001) alert("Invalid bind");
                        else setMenuKey(bind);
                      }}
                      reset={() => setMenuKey()}
                      unbind={() => setMenuKey(-1)}
                    />
                  </BindHolder>
                  <Switch
                    title="Menu Button"
                    defaultChecked={menuButton}
                    onChange={(event) => {
                      if (menuKey === -1) {
                        event.currentTarget.checked = false;
                        alert(
                          "You must set a menu keybind before disabling the button"
                        );
                      } else {
                        // use sketchConfig.set so it's instant
                        sketchConfig.set(
                          "menuButton",
                          event.currentTarget.checked
                        );
                        updateSketchMenuButton();
                      }
                    }}
                  />
                  <Switch
                    title="Streamer Mode"
                    description="When enabled, the cheat will silently fail if there's an update, the access key expires, or the cheat isn't updated. To disable this setting, visit the Sketch guide and look for the 'Resetting Hide Updates/Key' section, which contains a link to disable the setting."
                    checked={silentFail}
                    onChange={(event) => {
                      if (
                        confirm(
                          "Enabling this setting will require you to follow the Sketch guide to disable it if there's an update, the access key expires, or the cheat isn't updated. The cheat won't load if any of these occur, and you won't be able to re-enable this option without following the guide. Proceed?"
                        )
                      ) {
                        setSilentFail(event.currentTarget.checked);
                      }
                    }}
                  />
                  <KeybindOverlayMenu />
                  <WatermarkMenu />
                </Set>
                <HeadlessSet>
                  <Link title="Guide" href={docsURL} />
                  <Link title="Discord Server" href={discordURL} />
                  <Control title="The Gaming Gurus" />
                  <Control title={`Sketch v${sketchVersion}`} />
                </HeadlessSet>
              </>
            );
          },
        },
        {
          name: "Combat",
          body: () => {
            return <AimbotMenu />;
          },
        },
        {
          name: "Misc",
          body: () => {
            return (
              <>
                <HeadlessSet>
                  <Switch
                    title="Third Person"
                    description="Enables third person mode"
                    defaultChecked={thirdPerson}
                    onChange={(event) => {
                      setThirdPerson(event.currentTarget.checked);
                      try {
                        getGame().players.regenMeshes(getLocalPlayer());
                      } catch {
                        // game or localPlayer aren't a thing yet
                      }
                    }}
                  />
                  <AdblockMenu />
                </HeadlessSet>
                <Set title="Movements">
                  <BhopMenu />
                </Set>
              </>
            );
          },
        },
        {
          name: "Visual",
          body: () => {
            return (
              <>
                <Set title="ESP">
                  <ESPMenu />
                </Set>
                <HeadlessSet>
                  <SkinHackMenu />
                  <Switch
                    title="Disable ADS FOV multiplier"
                    defaultChecked={noAdsFovMlt}
                    onChange={(event) =>
                      setNoAdsFovMlt(event.currentTarget.checked)
                    }
                  />
                </HeadlessSet>
                <Set title="Custom Map">
                  <Text
                    title="Map Overrides"
                    description="If the overrides should take effect"
                    defaultValue={JSON.stringify(mapOverridesCode)}
                    onChange={(event) => {
                      let p;
                      try {
                        p = JSON.parse(event.currentTarget.value);
                      } catch (err) {
                        alert(
                          "Bad map overrides:\n" + (err as SyntaxError).stack
                        );
                        return;
                      }
                      setMapOverridesCode(p);
                      redrawSky();
                    }}
                  />
                  <Switch
                    title="Use Map Overrides"
                    description="JSON data to always merge with the current map. Use for sky color etc etc"
                    defaultChecked={mapOverrides}
                    onChange={(event) => {
                      setMapOverrides(event.currentTarget.checked);
                      redrawSky();
                    }}
                  />
                  <ColorPicker
                    title="Sky Color"
                    description="Changes the sky's color"
                    defaultValue={skyColorHex}
                    onChange={(event) => {
                      setSkyColorHex(event.currentTarget.value);
                      if (sketchConfig.get("skyColor")) redrawSky();
                    }}
                  />
                  <Switch
                    title="Use Custom Sky Color"
                    description="Changes the sky's color"
                    defaultChecked={skyColor}
                    onChange={(event) => {
                      setSkyColor(event.currentTarget.checked);
                      redrawSky();
                    }}
                  />
                </Set>
              </>
            );
          },
        },
      ]}
    />
  );
}
