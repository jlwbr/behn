/// <reference lib="dom" />

import htmx from "htmx.org";
import "hyperscript.org";

declare global {
  interface Window {
    htmx: typeof htmx;
  }
}

window.htmx = htmx;
