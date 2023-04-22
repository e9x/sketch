import { getKeyCode, getKeyName } from "../../keys";
import Control from "./Control";
import type { BaseControlProps } from "./Control";
import type { ReactNode } from "react";

export interface BindProps {
  bind: number;
  reset: () => void;
  unbind: () => void;
  setBind: (bind: number) => void;
}

export function Bind({ bind, reset, unbind, setBind }: BindProps) {
  const [changing, setChanging] = React.useState(false);

  React.useEffect(() => {
    if (!changing) return;

    const listener = (event: KeyboardEvent | MouseEvent) => {
      setChanging(false);
      setBind(getKeyCode(event));
    };

    window.addEventListener("mousedown", listener, { once: true });
    window.addEventListener("keydown", listener, { once: true });

    return () => {
      window.removeEventListener("mousedown", listener);
      window.removeEventListener("keydown", listener);
    };
  }, [changing]);

  return (
    <div style={{ float: "right" }}>
      <span className="reset" title="Reset Bind" onClick={() => reset()}>
        <i
          className="material-icons"
          style={{ fontSize: "40px", color: "var(--yellow)" }}
        >
          refresh
        </i>
      </span>
      <span className="unbind" title="Unbind" onClick={() => unbind()}>
        <i
          className="material-icons"
          style={{ fontSize: "40px", color: "var(--red)" }}
        >
          delete_forever
        </i>
      </span>
      <span
        className="settText floatRNoC keyIcon"
        onMouseOver={() => playTick()}
        onClick={() => setChanging(true)}
      >
        {changing ? "Press any Key" : getKeyName(bind)}
      </span>
    </div>
  );
}

export interface BindHolderProps extends BaseControlProps {
  children: ReactNode;
}

export default function BindHolder({
  title,
  attention,
  description,
  children,
}: BindHolderProps) {
  const betweens: ReactNode[] = [];

  if (Array.isArray(children))
    for (let i = 0; i < children.length; i++) {
      betweens.push(<React.Fragment key={i}>{children[i]}</React.Fragment>);
      if (i + 1 !== children.length)
        betweens.push(<div className="bindSep" key={i + "_sep"}></div>);
    }
  else betweens.push(children);

  return (
    <Control title={title} attention={attention} description={description}>
      {betweens}
    </Control>
  );
}
