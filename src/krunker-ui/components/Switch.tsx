import { h } from "preact";
import { Control } from "./Control.jsx";
import type { BaseControlProps } from "./Control.jsx";

export interface SwitchProps extends BaseControlProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
}

export function Switch({
  title,
  attention,
  description,
  checked,
  defaultChecked,
  onChange,
}: SwitchProps) {
  return (
    <Control title={title} attention={attention} description={description}>
      <label className="switch" style={{ marginLeft: 10 }}>
        <input
          type="checkbox"
          onInput={onChange}
          checked={checked}
          defaultChecked={defaultChecked}
        />
        <span className="slider"></span>
      </label>
    </Control>
  );
}
