// The models list: index.html.
import { Fragment } from "react";
import type { Catalog, Model } from "../types";
import { idIsDisplayName, modelHref, orderedVariants, UPLIFT_HELP, variantBest } from "../lib/catalog";
import { facetsOf } from "../lib/facets";
import { gpuGroup } from "../lib/hues";
import { Chip, DeprecatedBadge, Hardware, improvementBar, linkItems, none, VariantLine } from "../components/bits";
import { ListPage } from "./ListPage";

function ModelCard({ m, hidden, scale }: { m: Model; hidden: boolean; scale: number }) {
  const links = linkItems(m, "btn", "Perf report");
  return (
    <article className="model" hidden={hidden}>
      <div className="model-head">
        <div>
          <h2 className="model-title">
            <a className="model-link" href={modelHref(m)} title={m.name}>
              {m.displayName}
            </a>{" "}
            <DeprecatedBadge m={m} />
          </h2>
          <div className="model-meta">
            {!idIsDisplayName(m) && <code>{m.name}</code>}
            {m.family && <Chip filter="family" value={m.family} />}
          </div>
        </div>
      </div>
      <div className="model-body">
        <div className="model-info">
          {m.description && (
            <p className="desc clamp" title={m.description}>
              {m.description}
            </p>
          )}
        </div>
        <div className="model-variants">
          <ul className="variants" aria-label="Variants">
            {orderedVariants(m).map((v) => {
              // Cards are narrow, so hardware leads the description line
              // instead of wrapping onto a line of its own.
              const hw = v.hardwareShort ? (
                <span className="variant-hw-inline" title={v.requiresSummary}>
                  <Hardware v={v} />
                </span>
              ) : null;
              const bar = improvementBar(m, v, scale, "v-imp");
              const line = <VariantLine v={v} cls="variant-line" />;
              return (
                <li key={v.id} className="variant">
                  {bar ? (
                    <div className="variant-top">
                      {line}
                      {bar}
                    </div>
                  ) : (
                    line
                  )}
                  {(hw || v.description) && (
                    <div className="variant-desc clamp" title={v.description ?? undefined}>
                      {hw}
                      {hw && v.description ? " · " : ""}
                      {v.description}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {links.length > 0 && <div className="links">{links.map((x) => x.el)}</div>}
        </div>
      </div>
    </article>
  );
}

// The table's improvement cell: one row per variant line, so each optimized
// variant's bar sits on its own line and the rest stay blank.
function improvementCell(m: Model, scale: number) {
  const variants = orderedVariants(m);
  const bars = variants.map((v) => improvementBar(m, v, scale, "t-imp-row"));
  if (!bars.some(Boolean)) return null;
  return (
    <>
      {bars.map((b, i) => (
        <Fragment key={variants[i].id}>{b ?? <div className="t-imp-row" aria-hidden="true"></div>}</Fragment>
      ))}
    </>
  );
}

// The table's links sit on the row of the variant each belongs to, like the
// bars beside them; any no listed variant owns go below.
function linksCell(m: Model) {
  const items = linkItems(m, "t-link", "Report");
  if (!items.length) return null;
  const variants = orderedVariants(m);
  const ids = new Set(variants.map((v) => v.id));
  const rest = items.filter((x) => !ids.has(x.id ?? "")).map((x) => x.el);
  if (rest.length === items.length) return <div className="t-links">{rest}</div>;
  return (
    <>
      {variants.map((v) => {
        const own = items.filter((x) => x.id === v.id).map((x) => x.el);
        return own.length ? (
          <div key={v.id} className="t-link-row">
            {own}
          </div>
        ) : (
          <div key={v.id} className="t-link-row" aria-hidden="true"></div>
        );
      })}
      {rest.length > 0 && <div className="t-links t-links-rest">{rest}</div>}
    </>
  );
}

// Compact view: no descriptions (the description is the name's tooltip).
function ModelRow({ m, hidden, scale }: { m: Model; hidden: boolean; scale: number }) {
  const gpus = [...new Set(m.versions[0].variants.flatMap((v) => v.hardware))].sort((a, b) => gpuGroup(a) - gpuGroup(b) || a.localeCompare(b));
  return (
    <tr hidden={hidden}>
      <td>
        <div className="t-name" title={m.description ? `${m.name} — ${m.description}` : m.name}>
          <a className="model-link" href={modelHref(m)}>
            {m.displayName}
          </a>{" "}
          <DeprecatedBadge m={m} />
        </div>
        {!idIsDisplayName(m) && (
          <div className="t-meta">
            <code>{m.name}</code>
          </div>
        )}
        <div className="t-gpus">
          {gpus.map((h) => (
            <Chip key={h} filter="hardware" value={h} />
          ))}
        </div>
      </td>
      <td>{m.family ? <Chip filter="family" value={m.family} /> : none}</td>
      <td className="t-variants">
        {orderedVariants(m).map((v) => (
          <VariantLine key={v.id} v={v} cls="t-variant" />
        ))}
      </td>
      <td className="num">{improvementCell(m, scale) || none}</td>
      <td>{linksCell(m) || none}</td>
    </tr>
  );
}

export function ModelsPage({ catalog }: { catalog: Catalog }) {
  const models = catalog.models;
  // Every bar in the table is drawn against the catalog's best result.
  const scale = Math.max(0, ...models.flatMap((m) => m.versions[0].variants.map((v) => variantBest(m, v.id)?.upliftPct || 0))) || 1;
  return (
    <ListPage
      catalog={catalog}
      cfg={{
        page: "models",
        noun: "models",
        facets: models.map(facetsOf),
        search: "Search models, variants, hardware…",
        sorts: [
          ["uplift", "Sort by improvement"],
          ["name", "Sort by name"],
          ["family", "Sort by family"],
        ],
        gpuWhat: "Models with a variant for",
        head: (th) => (
          <>
            {th("name", "Model")}
            {th("family", "Family")}
            <th scope="col">Variants (latest)</th>
            {th("uplift", "Improvement vs baseline", { cls: "num", title: UPLIFT_HELP, sub: "best workload" })}
            <th scope="col">Links</th>
          </>
        ),
        card: (i, hidden) => <ModelCard key={i} m={models[i]} hidden={hidden} scale={scale} />,
        row: (i, hidden) => <ModelRow key={i} m={models[i]} hidden={hidden} scale={scale} />,
      }}
    />
  );
}
