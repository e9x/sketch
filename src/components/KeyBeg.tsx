import tokenConfig from "../tokenConfig";
import { linkvertiseURL } from "../consts";
import KrunkBox from "../KrunkBox";

export default function KeyBeg() {
  const abort = React.useRef(new AbortController())

  return (
    <>
      <h1>License Required</h1>
      <p>
        In order to pay for servers and development, we've partnered with
        Linkvertise.
      </p>
      <p>
        <a href={location.toString()} onClick={(event) => {
          event.preventDefault();
          abort.current.abort();
          abort.current = new AbortController();
          KrunkBox.generateTmpToken(abort.current.signal).then(tmpToken => {
            tokenConfig.set("tmpToken", tmpToken);
            location.replace(linkvertiseURL)
          }).catch(() => {
            //
          });
        }}>Get a free license key</a>
      </p>
      <p>
        <a href="https://sketch.sys32.dev/docs/quick-start/" target="_blank">Video Tutorial</a>
      </p>
    </>
  );
}
