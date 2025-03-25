import { h } from "preact";
import { forwardRef } from "preact/compat";
import { Control } from "./Control.jsx";
import type { BaseControlProps } from "./Control.jsx";

export interface PickerProps extends BaseControlProps {
  /**
   * Value of the path input. Use defaultValue if the path input should be editable
   */
  value?: string;
  /**
   * Default value of the path input
   */
  defaultValue?: string;
  /**
   * If the path input should be editable or read only.
   */
  readOnly?: boolean;
  /**
   * Called when the path input is updated
   */
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
  /**
   * Called when the browse button is pressed
   */
  onBrowse?: h.JSX.MouseEventHandler<HTMLInputElement>;
}

/**
 * Generic path picker
 * Compatible with native clients and browsers
 */
export const Picker = forwardRef<HTMLInputElement, PickerProps>(function Picker(
  {
    title,
    attention,
    description,
    value,
    defaultValue,
    readOnly,
    onChange,
    onBrowse,
  },
  ref
) {
  return (
    <Control title={title} attention={attention} description={description}>
      <div className="settingsBtn" style={{ width: 100 }} onClick={onBrowse}>
        Browse
      </div>
      <input
        ref={ref}
        type="text"
        name="text"
        className="inputGrey2"
        value={value}
        defaultValue={defaultValue}
        spellcheck={false}
        readOnly={readOnly}
        onChange={onChange}
      />
    </Control>
  );
});
