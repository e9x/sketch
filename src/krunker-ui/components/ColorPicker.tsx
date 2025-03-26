import { h } from "preact";
import type { BaseControlProps } from "./Control.jsx";
import { Control } from "./Control.jsx";

export interface ColorPickerProps extends BaseControlProps {
  value?: string;
  defaultValue?: string;
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
  onInput?: h.JSX.GenericEventHandler<HTMLInputElement>;
}

export function ColorPicker({
  title,
  attention,
  description,
  value,
  defaultValue,
  onChange,
  onInput,
}: ColorPickerProps) {
  return (
    <Control title={title} attention={attention} description={description}>
      <input
        type="color"
        name="color"
        style={{ float: "right" }}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onInput={onInput}
      />
    </Control>
  );
}
