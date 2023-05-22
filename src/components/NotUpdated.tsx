import { discordURL } from "../consts";

export default function NotUpdated() {
  return (
    <>
      <h1>Sketch is outdated and an update isn't available.</h1>
      <hr />
      <p>You'll have to wait for an update.</p>
      <p style={{ fontSize: "0.6em" }}>
        <em>Sketch has to be updated every time Krunker updates.</em>
      </p>
      <p>
        <a href={discordURL}>Discord server</a>
      </p>
    </>
  );
}
