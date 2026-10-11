import { encodePath, fetchCatalog, latestVersion } from "../lib/catalog";
import { ModelPage } from "../pages/model";
import { mount } from "./app";

// Every model's page is this one, at models/<name>/index.html: the path names
// the model, and the site's root is two directories up.
const ROOT = "../../";

mount(async () => {
  const dir = decodeURIComponent(/\/models\/([^/]+)\/(?:index\.html)?$/.exec(location.pathname)?.[1] ?? "");
  const m = (await fetchCatalog(ROOT)).models.find((x) => x.dir === dir);
  if (!m) throw new Error(`no model ${dir} in it`);
  document.title = `${m.displayName} · Model Catalog`;
  // Each variant's configuration is its own lines of the published version file.
  const res = await fetch(ROOT + encodePath(latestVersion(m).path));
  return <ModelPage m={m} versionText={res.ok ? await res.text() : null} />;
});
