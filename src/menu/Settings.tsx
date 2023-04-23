export interface Tab {
  name: string;
  body: React.ComponentType;
}

export default function Settings({ tabs }: { tabs: Tab[] }) {
  const [tabID, setTabID] = React.useState<number>(0);
  const tab = tabs[tabID];
  if (!tab) throw new TypeError("Bad tab");
  const { body: Body } = tab;

  return (
    <>
      <div className="settingsHeader">
        <div id="settingsTabLayout">
          {tabs.map((tab, i) => (
            <div
              className={`settingTab ${tabID === i ? "tabANew" : ""}`}
              onMouseEnter={() => playTick()}
              onClick={() => {
                playSelect(0.1);
                setTabID(i);
              }}
              key={i}
            >
              {tab.name}
            </div>
          ))}
        </div>
      </div>
      <div id="settHolder">
        <Body />
      </div>
    </>
  );
}
