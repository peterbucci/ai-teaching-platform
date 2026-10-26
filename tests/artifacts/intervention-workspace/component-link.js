import React from "react";
import { go } from "./component-navigation.js";
const Link = React.forwardRef(function FixtureLink(
  { href, onClick, scroll: _scroll, prefetch: _prefetch, ...props },
  ref,
) {
  void _scroll;
  void _prefetch;
  return React.createElement("a", {
    ...props,
    ref,
    href,
    onClick: (event) => {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      go(href);
    },
  });
});
export default Link;
