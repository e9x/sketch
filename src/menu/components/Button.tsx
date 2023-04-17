import Control from "./Control";
import type { BaseControlProps } from "./Control";
import type { MouseEventHandler } from "react";

export interface ButtonProps extends BaseControlProps {
  text: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export default function Button({
  title,
  attention,
  description,
  text,
  onClick,
}: ButtonProps) {
  return (
    <Control title={title} attention={attention} description={description}>
      <div className="settingsBtn" onClick={onClick}>
        {text}
      </div>
    </Control>
  );
}
