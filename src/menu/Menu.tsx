import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { ESPMenu } from "../cheats/esp";
import { ForceAutoMenu } from "../cheats/forceAuto";
import { RecoilControlMenu } from "../cheats/recoilControl";
import { TriggerbotMenu } from "../cheats/triggerbot";
import { discordURL, docsURL, sketchVersion } from "../consts";
import sketchConfig, { useSketchConfig } from "../sketchConfig";
import Settings from "./Settings";
import BindHolder, { Bind } from "./components/Bind";
import Control from "./components/Control";
import Link from "./components/Link";
import { HeadlessSet, Set } from "./components/Set";
import Switch from "./components/Switch";

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

  return (
    <Settings
      defaultTabID={defaultTabID}
      onTabChange={(tabID) => {
        defaultTabID = tabID;
      }}
      header={
        <>
          <h1
            style={{
              color: "white",
              textAlign: "center",
              fontFamily: "'Delicious Handrawn', cursive",
              fontSize: "4em",
              margin: "9px 0",
            }}
          >
            Sketch
          </h1>
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
                        else setMenuKey(bind)
                      }}
                      reset={() => setMenuKey()}
                      unbind={() => setMenuKey(-1)}
                    />
                  </BindHolder>
                  <Switch
                    title="Menu Button"
                    attention
                    description="Requires Restart"
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
                        location.reload();
                      }
                    }}
                  />
                  <Switch
                    title="Hide Updates/Key"
                    description="Recommended for streamers. When enabled, the cheat will silently fail if there's an update, the access key expires, or the cheat isn't updated. To disable this setting, visit the Sketch guide and look for the 'Resetting Hide Updates/Key' section, which contains a link to disable the setting."
                    checked={silentFail}
                    onChange={(event) => {
                      if (confirm("Enabling this setting will require you to follow the Sketch guide to disable it if there's an update, the access key expires, or the cheat isn't updated. The cheat won't load if any of these occur, and you won't be able to re-enable this option without following the guide. Proceed?")) {
                        setSilentFail(event.currentTarget.checked);
                      }
                    }}
                  />
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
          name: "Aim",
          body: () => {
            return <AimbotMenu />;
          },
        },
        {
          name: "Skill",
          body: () => {
            return (
              <>
                <Set title="Skill">
                  <BhopMenu />
                  <ForceAutoMenu />
                </Set>
                <Set title="Triggerbot">
                  <TriggerbotMenu />
                </Set>
                <Set title="Recoil Control">
                  <RecoilControlMenu />
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
                <HeadlessSet>
                  <Switch
                    title="Disable ADS FOV multiplier"
                    defaultChecked={noAdsFovMlt}
                    onChange={(event) =>
                      setNoAdsFovMlt(event.currentTarget.checked)
                    }
                  />
                </HeadlessSet>
                <Set title="ESP">
                  <ESPMenu />
                </Set>
              </>
            );
          },
        },
      ]}
    />
  );
}
