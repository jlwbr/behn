/// <reference types="@kitajs/html/htmx.d.ts" />

import "@kitajs/html/register";
import type { Layout } from "behn";

const App: Layout = ({ children }) => (
  <html lang="en">
    <head>
      <title>Behn example</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>

    <body>{children}</body>
  </html>
);

export default App;
