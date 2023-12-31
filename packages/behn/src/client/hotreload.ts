import { DiffDOM } from "diff-dom";

const dd = new DiffDOM();

function connect() {
  const socket = new WebSocket(`ws://${window.location.host}/.htmx/hotreload`);

  socket.onclose = function (e) {
    console.log("HMR Socket closed. Reconnecting in 1 second.", e.reason);
    setTimeout(function () {
      connect();
    }, 1000);
  };

  socket.onerror = function (err) {
    console.error("HMR Socket encountered error: ", err.type, "Closing socket");
    socket.close();
  };

  socket.addEventListener("message", async (event) => {
    const currentUrl = new URL(window.location.href);
    const urls: string[] = JSON.parse(event.data);
    const url = urls.some((url) => url === currentUrl.pathname);
    if (!url) return;

    const newDocument = await fetch(currentUrl).then(async (data) =>
      new DOMParser().parseFromString(await data.text(), "text/html"),
    );

    const body = dd.diff(document.body, newDocument.body);
    document.head.innerHTML = newDocument.head.innerHTML;
    const success = dd.apply(document.body, body);

    if (!success) {
      console.warn("HMR Failed, reloading document");
      window.location.reload();
    }
  });
}

connect();
