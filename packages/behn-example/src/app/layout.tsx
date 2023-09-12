import '@elysiajs/html';

const App = ({ children }: { children: any }) => (
  <html lang="en">
    <head>
      <title>Nano JSX SSR</title>
      <meta
        name="description"
        content="Server Side Rendered Nano JSX Application"
      />
    </head>

    <body>
      <p>Hey, im the main layout</p>
      {children}
    </body>
  </html>
);

export default App;
