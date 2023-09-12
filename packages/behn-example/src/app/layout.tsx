import { h } from "nano-jsx";

const App = ({ children }: { children: any }) => (
  <html lang="en">
    <head>
      <title>Nano JSX SSR</title>
      <meta
        name="description"
        content="Server Side Rendered Nano JSX Application"
      />
    </head>

    <body>{children}</body>
  </html>
);

export default App;
