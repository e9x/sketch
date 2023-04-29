/* eslint-disable @typescript-eslint/ban-types */
export const functionStrings = new WeakMap<Function, string>();

export function mirrorAttributes<From extends Function, To extends Function>(
  from: From,
  to: To,
  isConstructor = false
) {
  functionStrings.set(to, from.toString());

  Reflect.defineProperty(to, "length", {
    configurable: true,
    enumerable: false,
    value: from.length,
    writable: false,
  });

  Reflect.defineProperty(to, "name", {
    configurable: true,
    enumerable: false,
    value: from.name,
    writable: false,
  });

  // sometimes the contexts are different
  Object.setPrototypeOf(to, Object.getPrototypeOf(from));

  if (isConstructor) {
    to.prototype = from.prototype;

    // this mill make the prototype of `from` unusable/sketchy
    // better make sure it's hidden
    Reflect.defineProperty(from.prototype, "constructor", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: to,
    });
  }

  return to;
}

const hookedContexts = new WeakSet<typeof globalThis>();

export function hookContext(
  context: typeof globalThis,
  extra?: (context: typeof globalThis) => void
) {
  if (hookedContexts.has(context)) return;

  hookedContexts.add(context);

  // hook new Function() and Function() to catch the game loading
  const { Function } = context;

  // use array to avoid V8 from inferring the function name based on the var name
  const [HookedFunction] = [
    function (...args: string[]) {
      if (new.target) return new Function(...args);
      else return Function(...args);
    },
  ];

  mirrorAttributes(Function, HookedFunction, true);

  context.Function = HookedFunction as typeof Function;

  // Hook toString
  // need to be very careful

  const { toString } = Function.prototype;
  const toStringCall = toString.call.bind(toString) as (
    arg0: Function
  ) => string;

  const getFuncString = functionStrings.get.bind(functionStrings) as (
    arg0: Function
  ) => ReturnType<(typeof functionStrings)["get"]>;

  const hookedToString = function (this: Function) {
    if (typeof this !== "function") {
      const error = new TypeError(
        "Function.prototype.toString requires that 'this' be a Function"
      );

      if (error.stack)
        error.stack = error.stack.replace(
          /^ {4}at toString.*?$/m,
          "    at toString (<anonymous>)"
        );

      throw error;
    }

    const spoofedString = getFuncString(this);

    if (spoofedString) return spoofedString;

    const string = toStringCall(this);

    /*if (
        !string.includes("[native code]") &&
        !string.includes("methodCaller")
      )
        console.error(string);*/

    return string;
  };

  mirrorAttributes(toString, hookedToString);

  Function.prototype.toString =
    hookedToString as typeof Function.prototype.toString;

  // Hook contentWindow to hook iframes
  const { HTMLIFrameElement } = context;

  const getContentWindow = (
    Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      "contentWindow"
    ) as {
      configurable: true;
      enumerable: true;
      get: (this: HTMLIFrameElement) => HTMLIFrameElement["contentWindow"];
      set: undefined;
    }
  ).get;

  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    configurable: true,
    enumerable: true,
    get: mirrorAttributes(getContentWindow, function (this: HTMLIFrameElement) {
      const win = getContentWindow.call(this) as typeof globalThis | null;

      if (win)
        try {
          hookContext(win, extra);
        } catch {
          // maybe the window is cross-origin
          // like captcha
          // console.error(err);
        }

      return win;
    }),
  });

  if (extra) extra(context);
}
