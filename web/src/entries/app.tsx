import { StrictMode, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

// Renders a page once its data has loaded, or says why it could not.
export function mount(load: () => Promise<ReactElement>) {
  const root = createRoot(document.getElementById("root")!);
  load().then(
    (page) => root.render(<StrictMode>{page}</StrictMode>),
    (err: Error) =>
      root.render(
        <main className="wrap">
          <p className="empty">Could not load the catalog: {err.message}</p>
        </main>
      )
  );
}
