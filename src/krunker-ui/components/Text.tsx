import { h } from "preact";
import { Control } from "./Control.jsx";
import type { BaseControlProps } from "./Control.jsx";

export interface TextProps extends BaseControlProps {
  placeholder?: string;
  defaultValue?: string;
  /**
   * False by default.
   */
  spellCheck?: boolean;
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
}

export function Text({
  title,
  attention,
  description,
  placeholder,
  defaultValue,
  spellCheck,
  onChange,
}: TextProps) {
  return (
    <Control title={title} attention={attention} description={description}>
      <input
        type="text"
        name="text"
        className="inputGrey2"
        placeholder={placeholder}
        value={defaultValue}
        onInput={onChange}
        spellcheck={spellCheck === true}
      />
    </Control>
  );
}
