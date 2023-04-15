import { AimbotMenu } from "../cheats/aimbot";
import { BhopMenu } from "../cheats/bhop";
import { Set } from "./components/Set";

export default function Menu() {
  return (
    <>
      <Set title="Art">
        <BhopMenu />
        <AimbotMenu />
      </Set>
    </>
  );
}
