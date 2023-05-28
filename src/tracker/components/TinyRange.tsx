import type { ChangeEvent } from "react";
import { useRef } from "react";

export default function TinyRange({
  title,
  onChange,
  defaultValue,
  min,
  max,
  step,
}: {
  title: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}) {
  const numberInput = useRef<HTMLInputElement | null>(null);
  const rangeInput = useRef<HTMLInputElement | null>(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "4px 12px",
      }}
    >
      <span
        style={{
          color: "#ffffff",
        }}
      >
        {title}
      </span>
      <input
        type="range"
        defaultValue={
          typeof defaultValue === "number"
            ? defaultValue.toString()
            : defaultValue
        }
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          if (numberInput.current)
            numberInput.current.valueAsNumber =
              event.currentTarget.valueAsNumber;
          if (onChange) onChange.call(undefined as never, event);
        }}
        style={{ marginLeft: "auto", marginRight: 5 }}
        ref={rangeInput}
      />
      <input
        type="number"
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
        style={{
          fontSize: "inherit",
        }}
        ref={numberInput}
      />
    </div>
  );
}
