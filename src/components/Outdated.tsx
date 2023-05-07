export default function Outdated({
  updateURL,
  latestVersion,
}: {
  updateURL: string;
  latestVersion: string;
}) {
  return (
    <>
      <h1>Update Sketch.</h1>
      <p>
        Your version of Sketch is outdated. Click{" "}
        <a href={updateURL}>this link here</a> to download the latest verison. (
        {latestVersion})
      </p>
      <p>
        <button onClick={() => location.reload()}>Refresh</button>
      </p>
    </>
  );
}
