(function detectFetchTampering() {
  const out = {
    suspicious: false,
    reasons: [],
    details: {}
  };

  function flag(reason, value) {
    out.suspicious = true;
    out.reasons.push(reason);
    if (value !== undefined) out.details[reason] = value;
  }

  function safe(fn) {
    try {
      return fn();
    } catch (err) {
      return { __error__: String(err && err.message || err) };
    }
  }

  const fetchRef = safe(() => window.fetch);
  if (!fetchRef || fetchRef.__error__) {
    flag("fetch_missing_or_unreadable", fetchRef);
    return out;
  }

  if (typeof fetchRef !== "function") {
    flag("fetch_not_function", typeof fetchRef);
    return out;
  }

  const fnToString = Function.prototype.toString;

  const fetchToString = safe(() => fetchRef.toString());
  const protoToString = safe(() => fnToString.call(fetchRef));
  const fnProtoToStringSelf = safe(() => fnToString.call(fnToString));
  const ownToString = safe(() => Object.prototype.hasOwnProperty.call(fetchRef, "toString"));
  const fetchDescriptor = safe(() => Object.getOwnPropertyDescriptor(window, "fetch"));
  const fetchProto = safe(() => Object.getPrototypeOf(fetchRef));
  const fetchName = safe(() => fetchRef.name);
  const fetchLength = safe(() => fetchRef.length);
  const fetchCtorName = safe(() => fetchRef.constructor && fetchRef.constructor.name);

  out.details.fetchToString = fetchToString;
  out.details.protoToString = protoToString;
  out.details.ownToString = ownToString;
  out.details.fetchDescriptor = fetchDescriptor;
  out.details.fetchName = fetchName;
  out.details.fetchLength = fetchLength;
  out.details.fetchCtorName = fetchCtorName;
  out.details.functionPrototypeToString = fnProtoToStringSelf;

  const nativeLike = s =>
    typeof s === "string" &&
    /\{\s*\[native code\]\s*\}/.test(s);

  if (!nativeLike(fetchToString)) {
    flag("fetch_toString_not_native_like", fetchToString);
  }

  if (!nativeLike(protoToString)) {
    flag("function_proto_toString_fetch_not_native_like", protoToString);
  }

  if (typeof fetchToString === "string" &&
      typeof protoToString === "string" &&
      fetchToString !== protoToString) {
    flag("fetch_toString_mismatch_with_function_proto", {
      fetchToString,
      protoToString
    });
  }

  if (ownToString === true) {
    flag("fetch_has_own_toString");
  }

  if (!nativeLike(fnProtoToStringSelf)) {
    flag("function_prototype_toString_hooked", fnProtoToStringSelf);
  }

  if (fetchDescriptor && !fetchDescriptor.__error__) {
    if ("value" in fetchDescriptor && fetchDescriptor.value !== fetchRef) {
      flag("window_fetch_descriptor_value_mismatch");
    }

    if (fetchDescriptor.get || fetchDescriptor.set) {
      flag("window_fetch_is_accessor_descriptor", fetchDescriptor);
    }
  } else {
    flag("window_fetch_descriptor_unreadable", fetchDescriptor);
  }

  if (fetchName !== "fetch") {
    flag("fetch_name_unexpected", fetchName);
  }

  if (typeof fetchLength === "number" && fetchLength < 1) {
    flag("fetch_length_unexpected", fetchLength);
  }

  if (fetchCtorName && fetchCtorName !== "Function") {
    flag("fetch_constructor_unexpected", fetchCtorName);
  }

  if (fetchProto && !fetchProto.__error__) {
    if (fetchProto !== Function.prototype) {
      flag("fetch_prototype_not_function_prototype", fetchProto);
    }
  }

  // Cross-realm comparison using a same-origin iframe.
  const iframeResult = safe(() => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.documentElement.appendChild(iframe);

    try {
      const cleanFetch = iframe.contentWindow.fetch;
      const cleanFnToString = iframe.contentWindow.Function.prototype.toString;

      const cleanFetchString = cleanFnToString.call(cleanFetch);
      const currentFetchString = fnToString.call(fetchRef);

      return {
        cleanFetchExists: typeof cleanFetch === "function",
        cleanFetchString,
        currentFetchString,
        sameString: cleanFetchString === currentFetchString
      };
    } finally {
      iframe.remove();
    }
  });

  out.details.iframeComparison = iframeResult;

  if (!iframeResult.__error__) {
    if (!iframeResult.cleanFetchExists) {
      flag("iframe_clean_fetch_missing");
    } else if (!iframeResult.sameString) {
      flag("cross_realm_fetch_string_mismatch", iframeResult);
    }
  } else {
    out.details.iframeComparisonError = iframeResult;
  }

  return out;
})();