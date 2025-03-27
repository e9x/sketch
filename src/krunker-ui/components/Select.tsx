import { h, type ComponentChild } from "preact";
import { Control } from "./Control.jsx";
import type { BaseControlProps } from "./Control.jsx";
import { useEffect, useRef } from "preact/hooks";

export interface SelectProps extends BaseControlProps {
  children?: ComponentChild;
  value?: string;
  defaultValue?: string;
  onChange?: h.JSX.GenericEventHandler<HTMLSelectElement>;
}

export function Select({
  title,
  attention,
  description,
  children,
  defaultValue,
  value,
  onChange,
}: SelectProps) {
  const sel = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (typeof value !== "undefined" && sel.current)
      sel.current.value = typeof value === "undefined" ? "" : value;
  }, [sel, value]);

  return (
    <Control title={title} attention={attention} description={description}>
      <select
        className="inputGrey2"
        ref={sel}
        value={defaultValue}
        onChange={onChange}
      >
        {children}
      </select>
    </Control>
  );
}
