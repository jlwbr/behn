/// <reference types="@kitajs/html/htmx.d.ts" />

import "@kitajs/html/register";
import type { Layout } from "behn";
import "../style/main.css";

const App: Layout = ({ children }) => (
  <html lang="en">
    <head>
      <title>Behn example</title>
    </head>

    <body>{children}</body>
  </html>
);

export default App;
