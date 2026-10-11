/// <reference types="vitest/config" />
// The GitHub Pages site: pages that render from catalog.json, and beside them
// the catalog swiss reads, built from models/ -- so the site's URL is a
// catalog location. hack/lib/site.js builds the data.
//
//   npm run dev:site       # http://localhost:5173, live from models/
//   npm run build:site     # site/; PUBLISHED_INDEX and REWRITES say how to
//                          # treat an edited published version
//   npm run preview:site   # site/, as built
//
// site/
//   index.html                 the models
//   variants.html              every model's variants, one entry each
//   models/<name>/index.html   each model
//   assets/                    the pages' scripts and styles
//   catalog.json               what the pages render from
//   models/<name>/*.html       perf reports, copied from the repo
//   index.json                 the index, built from models/
//   models/<name>/*.yaml       every version file it names
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { loadCatalog, checkedIndex, writeSiteData, buildIndex, serializeIndex } = require("../hack/lib/site.js");
const { modelNames } = require("../hack/lib/catalog.js");

const web = import.meta.dirname;
const repo = path.resolve(web, "..");
const models = path.join(repo, "models");
const outDir = path.join(repo, "site");

// Every model's page is model.html, served and built at models/<name>/index.html.
const template = path.join(web, "model.html");
const modelPage = /^\/models\/[^/]+\/(?:index\.html)?$/;
const inModels = (file: string) => file.startsWith(models + path.sep) && fs.existsSync(file);
const isModelEntry = (id: string) => id.startsWith(path.join(web, "models") + path.sep) && id.endsWith(`${path.sep}index.html`);

function catalogSite(): Plugin {
  let building = false;
  let published: unknown;
  return {
    name: "catalog-site",

    config(_, { command }) {
      building = command === "build";
      if (!building) return;
      const input: Record<string, string> = { index: path.join(web, "index.html"), variants: path.join(web, "variants.html") };
      for (const dir of modelNames()) input[`models/${dir}`] = path.join(web, "models", dir, "index.html");
      // The data is written after the bundle and takes most of the build;
      // that is expected, not worth a warning.
      return { build: { rolldownOptions: { input, checks: { pluginTimings: false } } } };
    },

    // Each model page is model.html at its own path, so Vite links it to the
    // shared assets from where it sits.
    resolveId: (id) => (isModelEntry(id) ? id : null),
    load: (id) => (isModelEntry(id) ? fs.readFileSync(template, "utf8") : null),

    // A build refuses an edit to a published version before writing anything.
    async buildStart() {
      if (building) published = await checkedIndex();
    },
    writeBundle() {
      console.log(writeSiteData(outDir, published));
    },

    // In dev, the same tree, live from models/: catalog.json and index.json
    // built per request, the reports and version files as they are on disk.
    configureServer(server) {
      // Built once and again after any edit under models/: it reads git for
      // every version file, which takes a few seconds.
      let catalog: unknown = null;
      server.watcher.add(models);
      server.watcher.on("all", (_, file) => {
        if (!file.startsWith(models + path.sep)) return;
        catalog = null;
        server.ws.send({ type: "full-reload" });
      });
      server.middlewares.use(async (req, res, next) => {
        const url = decodeURIComponent((req.url ?? "/").split(/[?#]/)[0]);
        try {
          if (url === "/catalog.json" || url === "/index.json") {
            res.setHeader("Content-Type", "application/json");
            res.end(url === "/catalog.json" ? JSON.stringify((catalog ??= loadCatalog())) : serializeIndex(buildIndex()));
          } else if (modelPage.test(url)) {
            res.setHeader("Content-Type", "text/html");
            res.end(await server.transformIndexHtml(req.url!, fs.readFileSync(template, "utf8")));
          } else if (/^\/models\/[^/]+\/[^/]+\.(html|yaml)$/.test(url) && inModels(path.join(repo, url))) {
            res.setHeader("Content-Type", url.endsWith(".html") ? "text/html" : "text/yaml");
            res.end(fs.readFileSync(path.join(repo, url)));
          } else {
            next();
          }
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  root: web,
  // Relative, so the site works under any path: GitHub Pages serves it at
  // /model-catalog/, and a model page sits two directories down.
  base: "./",
  // Pages, not one app: an unknown path is a 404, not the models list.
  appType: "mpa",
  // With the repository's node_modules, not a second one in web/.
  cacheDir: path.join(repo, "node_modules/.vite"),
  plugins: [react(), catalogSite()],
  build: { outDir, emptyOutDir: true },
  test: { include: ["src/**/*.test.ts"] },
});
