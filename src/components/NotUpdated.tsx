import { discordURL } from "../consts";

export default function NotUpdated() {
  return (
    <>
      <h1>Sketch isn't updated.</h1>
      <a href={discordURL}>Discord server</a>
    </>
  );
}
