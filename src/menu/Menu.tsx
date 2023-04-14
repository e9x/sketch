import useConfig, { defaultConfig } from "../config";
import { Set } from "./components/Set";
import Switch from "./components/Switch";

export default function Menu() {
  const [bhop, setBhop] = useConfig("bhop", defaultConfig.bhop);

  return (
    <>
      <Set title="Art">
        <Switch
          title="Bhop"
          defaultChecked={bhop}
          onChange={(event) => setBhop(event.currentTarget.checked)}
        />
      </Set>
    </>
  );
}
