import { h } from "preact";
import { useRef } from "preact/hooks";
import { Control } from "./Control.jsx";
import type { BaseControlProps } from "./Control.jsx";

export interface SliderProps extends BaseControlProps {
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: h.JSX.GenericEventHandler<HTMLInputElement>;
}

export function Slider({
  title,
  attention,
  description,
  defaultValue,
  min,
  max,
  step,
  onChange,
}: SliderProps) {
  const numberInput = useRef<HTMLInputElement | null>(null);
  const rangeInput = useRef<HTMLInputElement | null>(null);

  return (
    <Control title={title} attention={attention} description={description}>
      <input
        type="number"
        className="sliderVal"
        min={min}
        max={max}
        step={step}
        defaultValue={
          typeof defaultValue === "number"
            ? defaultValue.toString()
            : defaultValue
        }
        onChange={(event) => {
          if (rangeInput.current)
            rangeInput.current.valueAsNumber =
              event.currentTarget.valueAsNumber;
          if (onChange) onChange.call(undefined as never, event);
        }}
        ref={numberInput}
        style={{ marginRight: 0, borderWidth: 0 }}
      />
      <div className="slidecontainer" style={{ marginTop: -8 }}>
        <input
          className="sliderM"
          type="range"
          min={min}
          max={max}
          step={step}
          value={defaultValue}
          onInput={(event) => {
            if (numberInput.current)
              numberInput.current.valueAsNumber =
                event.currentTarget.valueAsNumber;
            if (onChange) onChange.call(undefined as never, event);
          }}
          ref={rangeInput}
        />
      </div>
    </Control>
  );
}
