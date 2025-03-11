import KrunkBox, { WorkInkErrors } from "../KrunkBox";
import { apiURL } from "../consts";

export default function KeyBeg({ done }: { done: (token: string) => void }) {
  const key = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <>
      <h1>Get your access key for Sketch.</h1>
      <p>
        In order to pay for servers and development, we've partnered with
        WorkInk.
      </p>
      <p>
        <a href={new URL("slavelabor", apiURL).href} target="_blank">
          Get Access Key
        </a>
      </p>
      <p>
        <a href="https://krunker.zip/docs/quick-start/" target="_blank">
          Video Tutorial
        </a>
      </p>
      {error && <p style={{ fontSize: "10px", color: "red" }}>{error}</p>}
      <form
        style={{ display: "flex", flexDirection: "row", gap: 5 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!key.current) return;

          setBusy(true);

          KrunkBox.processWorkInk(key.current.value.trim())
            .then((res) => {
              console.trace(res);
              if (res.success) done(res.token);
              else {
                switch (res.error[0]) {
                  case "sketch_key_validate.invalid":
                    setError("Bad access key. Try again.");
                    break;
                  case "sketch_key_validate.used":
                    setError("Access key already used. Try again.");
                    break;
                  default:
                    console.warn("no msg for", res.error[0]);
                    setError(res.error[0]);
                    break;
                }
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        <input type="text" placeholder="Access Key" disabled={busy} ref={key} />
        <input type="submit" value="Done" disabled={busy} />
      </form>
    </>
  );
}
