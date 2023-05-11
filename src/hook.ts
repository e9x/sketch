/* eslint-disable @typescript-eslint/ban-types */

export const functionStrings = new WeakMap<Function, string>();

export interface Attributes {
  length?: number;
  name?: string;
  string?: string;
}

export function setAttributes<To extends Function>(to: To, from: Attributes) {
  if (typeof from.length === "number")
    Reflect.defineProperty(to, "length", {
      configurable: true,
      enumerable: false,
      value: from.length,
      writable: false,
    });

  if (typeof from.name === "string")
    Reflect.defineProperty(to, "name", {
      configurable: true,
      enumerable: false,
      value: from.name,
      writable: false,
    });

  if (typeof from.string === "string") functionStrings.set(to, from.string);

  return to;
}

export function mirrorAttributes<To extends Function, From extends Function>(
  to: To,
  from: From,
  isConstructor = false
) {
  setAttributes(to, {
    string: from.toString(),
    length: from.length,
    name: from.name,
  });

  // sometimes the contexts are different
  Reflect.setPrototypeOf(to, Reflect.getPrototypeOf(from));

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

  return to as unknown as From;
}

/**
 * Replaces `toString()` of the function with fake native code.
 */
export function setNativeFunction<T extends Function>(
  f: T,
  name: string,
  attributes: Attributes = {}
) {
  setAttributes(f, {
    string: `function ${name}() { [native code] }`,
    ...attributes,
  });

  return f;
}

export type NativeMethodDescriptor = "value" | "get" | "set";

export type NativeDescriptorMap = {
  [K in NativeMethodDescriptor]?: Attributes;
};

/**
 * Modifies `value`, `get`, and `set` if they're functions.
 * Replaces `toString()` of the values with fake native code.
 */
export function nativeDescriptor(
  propertyKey: string,
  descriptor: PropertyDescriptor,
  attributes: { [K in NativeMethodDescriptor]?: Attributes } = {}
) {
  for (const key of ["value", "get", "set"] as NativeMethodDescriptor[]) {
    if (!(key in descriptor)) continue;

    const value = descriptor[key];

    if (typeof value !== "function") continue;

    setAttributes(value, {
      string: `function ${
        key === "value" ? propertyKey : `${key} ${propertyKey}`
      }() { [native code] }`,
      ...(key in attributes ? attributes[key] : {}),
    });
  }

  return descriptor;
}

export const hookedContexts = new WeakSet<typeof globalThis>();

export type HookConstruct = (...args: string[]) => Function;

export interface HookOptions {
  newFunction?: (
    args: string[],
    construct: HookConstruct
  ) => ReturnType<HookConstruct>;
}

export function hookContext(
  context: typeof globalThis,
  extra?: (context: typeof globalThis) => void,
  hookContentWindows = true
) {
  if (hookedContexts.has(context)) return;

  hookedContexts.add(context);

  // Hook toString
  // need to be very careful
  const { toString } = context.Function.prototype;
  const toStringCall = toString.call.bind(toString) as (
    arg0: Function
  ) => string;

  const getFuncString = functionStrings.get.bind(functionStrings);

  // use short-hand method so .prototype isn't created
  const hookedToString = {
    toString(this: Function) {
      if (typeof this !== "function") {
        const error = new TypeError(
          "Function.prototype.toString requires that 'this' be a Function"
        );

        // ({t:Function.prototype.toString}.t())
        //     Object.toString [as t] (<anonymous>)

        // Function.prototype.toString.call()
        //     toString (<anonymous>)

        if (error.stack)
          error.stack = error.stack.replace(
            /^ {4}at (.*?) \(eval at .*?\)$/m,
            "    at $1 (<anonymous>)"
          );

        throw error;
      }

      const spoofedString = getFuncString(this);

      if (spoofedString) return spoofedString;

      const string = toStringCall(this);

      /*if (!string.includes("[native code]") && !string.includes("methodCaller"))
        console.error("NOT SANDBOXED:", string);*/

      return string;
    },
  }.toString;

  mirrorAttributes(toString, hookedToString);

  context.Function.prototype.toString =
    hookedToString as typeof Function.prototype.toString;

  if (hookContentWindows) {
    // Hook contentWindow to hook iframes
    const getContentWindow = (
      Object.getOwnPropertyDescriptor(
        context.HTMLIFrameElement.prototype,
        "contentWindow"
      ) as {
        configurable: true;
        enumerable: true;
        get: (this: HTMLIFrameElement) => HTMLIFrameElement["contentWindow"];
        set: undefined;
      }
    ).get;
    const callGetContentWindow =
      context.Function.prototype.call.bind(getContentWindow);

    Object.defineProperty(
      context.HTMLIFrameElement.prototype,
      "contentWindow",
      nativeDescriptor("contentWindow", {
        configurable: true,
        enumerable: true,
        get(this: HTMLIFrameElement) {
          try {
            const win = callGetContentWindow(this) as typeof globalThis | null;

            if (win)
              try {
                hookContext(win, extra, hookContentWindows);
              } catch {
                // maybe the window is cross-origin
                // like captcha
                // console.error(err);
              }

            return win;
          } catch {
            const error = new TypeError("Illegal invocation");

            if (error.stack)
              error.stack = error.stack.replace(/ {4}at .*?\n/m, "");

            throw error;
          }
        },
      })
    );
  }

  if (extra) extra(context);
}
