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

  return (
    <Settings
      defaultTabID={defaultTabID}
      onTabChange={(tabID) => {
        defaultTabID = tabID;
      }}
      header={
        <>
          <h1 style={{ color: "white", textAlign: "center" }}>Sketch</h1>
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
                      setBind={(bind) => setMenuKey(bind)}
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
                </Set>
                <HeadlessSet>
                  <Link title="Documentation" href={docsURL} />
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
