import { ControlContainer, ControlTitle } from "./Control";
import type { BaseControlProps } from "./Control";

export interface LinkProps extends BaseControlProps {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export default function Link({
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
