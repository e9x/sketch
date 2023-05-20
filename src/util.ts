export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

export function random(min: number, max: number, decimal = false) {
  return (
    (decimal
      ? Math.random() * (max - min)
      : ~~(Math.random() * (max - min + 1))) + min
  );
}

type TrueLike<T> = Exclude<NonNullable<T>, false>;

/**
 * Poll a condition every x MS.
 */
export function waitFor<T>(
  check: () => T,
  interval = 50
): Promise<TrueLike<T>> {
  return new Promise((resolve) => {
    let set: ReturnType<typeof setInterval>;

    const run = () => {
      try {
        const result = check();

        if (result) {
          if (set) clearInterval(set);
          resolve(result as TrueLike<T>);

          return true;
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (!run()) set = setInterval(run, interval);
  });
}
