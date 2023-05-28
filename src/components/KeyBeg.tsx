import KrunkBox, { ProcessTokenErrors } from "../KrunkBox";
import { isNode, linkvertiseURL } from "../consts";
import tokenConfig from "../tokenConfig";
import { useRef, useState } from "react";

const badToken =
  "Bad access key. If you just received an access key, try getting another one in 8 minutes.";

const didntClickLink =
  'Bad access key. Make sure you\'re opening the "Get a free access key" link from this website/client.';

export default function KeyBeg({ done }: { done: (token: string) => void }) {
  const abort = useRef(new AbortController());
  const key = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
                if (isNode)
                  require("electron").shell.openExternal(linkvertiseURL);
                else GM_openInTab(linkvertiseURL, { active: true });
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

          const tmpToken = tokenConfig.get("tmpToken");

          setBusy(true);

          KrunkBox.processToken(key.current.value.trim(), tmpToken)
            .then((res) => {
              tokenConfig.delete("tmpToken");

              switch (res) {
                case ProcessTokenErrors.BadToken:
                  setError(tmpToken === "" ? didntClickLink : badToken);
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
