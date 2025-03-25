import { h } from "preact";
import type { BaseControlProps } from "./Control.jsx";
import { ControlContainer, ControlTitle } from "./Control.jsx";

export interface LinkProps extends BaseControlProps {
  href: string;
  onClick?: h.JSX.MouseEventHandler<HTMLAnchorElement>;
}

export function Link({
  title,
  attention,
  description,
  href,
  onClick,
}: LinkProps) {
  return (
    <ControlContainer description={description}>
      <a href={href} onClick={onClick}>
        <ControlTitle attention={attention}>{title}</ControlTitle>
      </a>
    </ControlContainer>
  );
}
