// The variants list: variants.html. Every model's variants in the version a
// deploy gets, one entry each, so they compare across models: by GPU, engine,
// image or improvement.
import type { Catalog, Model, Variant } from "../types";
import { anchorOf, latestVersion, modelHref, orderedVariants, UPLIFT_HELP } from "../lib/catalog";
import { variantFacetsOf } from "../lib/facets";
import { chartCode, Chip, DeprecatedBadge, Fact, Hardware, imageCode, improvementBar, linkItems, none, VariantBadges } from "../components/bits";
import { ListPage } from "./ListPage";

// The id and badges; the id opens the variant on its model page.
function VariantRef({ m, v, cls }: { m: Model; v: Variant; cls: string }) {
  return (
    <div className={cls}>
      <a className="variant-id" href={`${modelHref(m)}#${anchorOf(m.latest, v.id)}`} title={v.description ? `${v.id}: ${v.description}` : v.id}>
        {v.id}
      </a>
      <VariantBadges v={v} />
    </div>
  );
}

// A variant's own perf reports and link.
function variantLinks(m: Model, v: Variant, cls: string, reportLabel: string) {
  return linkItems(m, cls, reportLabel)
    .filter((x) => x.id === v.id)
    .map((x) => x.el);
}

function VariantCard({ m, v, hidden, scale }: { m: Model; v: Variant; hidden: boolean; scale: number }) {
  const hw = v.hardwareShort ? (
    <span className="variant-hw-inline" title={v.requiresSummary}>
      <Hardware v={v} />
    </span>
  ) : null;
  const line = <VariantRef m={m} v={v} cls="variant-line" />;
  const bar = improvementBar(m, v, scale, "v-imp");
  const links = variantLinks(m, v, "btn", "Perf report");
  return (
    <article className="model vcard" hidden={hidden}>
      <div className="model-meta">
        <a className="model-link" href={modelHref(m)} title={m.name}>
          {m.displayName}
        </a>
        <DeprecatedBadge m={m} />
        {m.family && <Chip filter="family" value={m.family} />}
      </div>
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
      <dl className="vcard-facts">
        <Fact label="Engine">{v.engine}</Fact>
        <Fact label="Image">{imageCode(v)}</Fact>
        <Fact label="Chart">{chartCode(v)}</Fact>
      </dl>
      {links.length > 0 && <div className="links">{links}</div>}
    </article>
  );
}

// Hardware with its GPU names as filter chips. A node count may wrap to a
// line of its own; the rest stays on one.
function HardwareCell({ v }: { v: Variant }) {
  const [, gpus, nodes] = v.hardwareShort.match(/^(.*?)(?: (× \d+ nodes))?$/)!;
  return (
    <>
      <span className="nowrap">
        <Hardware v={v} short={gpus} mark={(label) => <Chip filter="hardware" value={label} />} />
      </span>
      {nodes && (
        <>
          {" "}
          <span className="nowrap">{nodes}</span>
        </>
      )}
    </>
  );
}

// The table: the model first, since many models share variant ids
// (sglang-tp8-h100-baseline); the engine and image under the id.
function VariantRow({ m, v, hidden, scale }: { m: Model; v: Variant; hidden: boolean; scale: number }) {
  const image = imageCode(v);
  const links = variantLinks(m, v, "t-link", "Report");
  return (
    <tr hidden={hidden}>
      <td>
        <div className="t-name" title={m.name}>
          <a className="model-link" href={modelHref(m)}>
            {m.displayName}
          </a>{" "}
          <DeprecatedBadge m={m} />
        </div>
        {m.family && (
          <div className="t-chips">
            <Chip filter="family" value={m.family} />
          </div>
        )}
      </td>
      <td>
        <VariantRef m={m} v={v} cls="t-variant" />
        {(v.engine || image) && (
          <div className="t-meta">
            {v.engine}
            {v.engine && image ? " · " : ""}
            {image}
          </div>
        )}
      </td>
      <td className="t-hw" title={v.requiresSummary || undefined}>
        {v.hardwareShort ? <HardwareCell v={v} /> : none}
      </td>
      <td className="num">{improvementBar(m, v, scale, "t-imp-row") || none}</td>
      <td>{links.length ? <div className="t-links">{links}</div> : none}</td>
    </tr>
  );
}

export function VariantsPage({ catalog }: { catalog: Catalog }) {
  const entries = catalog.models.flatMap((m) => orderedVariants(m, latestVersion(m).variants).map((v, rank) => ({ m, v, rank })));
  const facets = entries.map(({ m, v, rank }) => variantFacetsOf(m, v, rank));
  // Every bar is drawn against the best result on the page.
  const scale = Math.max(0, ...facets.map((f) => f.uplift || 0)) || 1;
  return (
    <ListPage
      catalog={catalog}
      cfg={{
        page: "variants",
        noun: "variants",
        facets,
        search: "Search variants, models, images, hardware…",
        sorts: [
          ["uplift", "Sort by improvement"],
          ["name", "Sort by model"],
          ["family", "Sort by family"],
          ["gpus", "Sort by GPUs"],
        ],
        gpuWhat: "Variants for",
        head: (th) => (
          <>
            {th("name", "Model")}
            <th scope="col">
              Variant<span className="th-sub">engine · image</span>
            </th>
            {th("gpus", "Hardware")}
            {th("uplift", "Improvement vs baseline", { cls: "num", title: UPLIFT_HELP, sub: "best workload" })}
            <th scope="col">Links</th>
          </>
        ),
        card: (i, hidden) => <VariantCard key={i} m={entries[i].m} v={entries[i].v} hidden={hidden} scale={scale} />,
        row: (i, hidden) => <VariantRow key={i} m={entries[i].m} v={entries[i].v} hidden={hidden} scale={scale} />,
      }}
    />
  );
}
