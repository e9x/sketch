import ColorPicker from "./menu/components/ColorPicker";
import FilePicker from "./menu/components/FilePicker";
import Link from "./menu/components/Link";
import { Set } from "./menu/components/Set";
import Slider from "./menu/components/Slider";

export default function Menu() {
  return (
    <>
      <Set title="Debug">
        <FilePicker
          title="Upload File"
          accept=".js"
          multiple
          onChange={async (event) => {
            for (const file of event.currentTarget.files!) {
              console.log("Decoding:", file.name);

              const ab = await file.arrayBuffer();

              console.log(new TextDecoder().decode(ab));
            }
          }}
        />
        <Link title="Link" href="about:blank" onClick={() => alert("click")} />
        <Slider
          title="Slider"
          defaultValue={12}
          min={-100}
          max={100}
          step={4.5}
        />
        <ColorPicker title="ColorPicker" defaultValue="#FF99DA" />
      </Set>
    </>
  );
}
