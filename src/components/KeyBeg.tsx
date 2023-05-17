import KrunkBox, { ProcessTokenErrors } from "../KrunkBox";
import { linkvertiseURL } from "../consts";
import tokenConfig from "../tokenConfig";

export default function KeyBeg({ done }: { done: (token: string) => void }) {
  const abort = React.useRef(new AbortController());
  const key = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <>
      <h1>Access Key Required</h1>
      <p>
        In order to pay for servers and development, we've partnered with
        Linkvertise.
      </p>
      <p>
        <a
          href={location.toString()}
          onClick={(event) => {
            event.preventDefault();
            abort.current.abort();
            abort.current = new AbortController();
            KrunkBox.generateTmpToken(abort.current.signal)
              .then((tmpToken) => {
                tokenConfig.set("tmpToken", tmpToken);
                GM_openInTab(linkvertiseURL, { active: true });
              })
              .catch(() => {
                //
              });
          }}
        >
          Get a free access key
        </a>
      </p>
      <p>
        <a href="https://sketch.sys32.dev/docs/quick-start/" target="_blank">
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

          const tmpToken = tokenConfig.get("tmpToken");

          if (!tmpToken) {
            setError("You need to get another access key.");
            return;
          }

          KrunkBox.processToken(key.current.value.trim(), tmpToken)
            .then((res) => {
              switch (res) {
                case ProcessTokenErrors.BadToken:
                  setError("Bad access key. Try again.");
                  break;
                default:
                  done(res);
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
