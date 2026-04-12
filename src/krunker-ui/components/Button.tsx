import { h } from "preact";
import { Control } from "./Control.jsx";
import type { BaseControlProps } from "./Control.jsx";

export interface ButtonProps extends BaseControlProps {
  text: string;
  onClick?: h.JSX.MouseEventHandler<HTMLDivElement>;
}

export function Button({
  title,
  attention,
  description,
  text,
  onClick,
}: ButtonProps) {
  return (
    <Control title={title} attention={attention} description={description}>
      <div className="settingsBtn" style={{ width: "auto", flexShrink: 0 }} onClick={onClick}>
        {text}
      </div>
    </Control>
  );
}
