// Pieces the lists and the model page share.
import { Fragment, type ReactElement, type ReactNode } from "react";
import type { Model, Variant } from "../types";
import { encodePath, reportLinks, REPORT_LANG, UPLIFT_HELP, variantBest } from "../lib/catalog";
import { computeSummary, type Facet } from "../lib/facets";
import { gpuGroup, gpuHue, tagHue } from "../lib/hues";
import { icons } from "./icons";

export const none = <span className="none">—</span>;

// Links open in a new tab, so the catalog stays where it was.
export const NEW_TAB = { target: "_blank", rel: "noopener" } as const;

// A filter chip. Family chips stay neutral, so a family never reads as a tag;
// GPU names wear the same highlight as in hardware lines.
export function Chip({ filter, value }: { filter: "tag" | "family" | "hardware"; value: string }) {
  const cls = filter === "tag" ? `chip hue-${tagHue(value)}` : filter === "hardware" ? `chip chip-gpu hue-${gpuHue(value)}` : "chip";
  return (
    <button type="button" className={cls} data-filter={filter} data-value={value} title={`Filter by ${filter}: ${value}`}>
      {value}
    </button>
  );
}

export function DeprecatedBadge({ m }: { m: Model }) {
  if (!m.deprecated) return null;
  return (
    <span className="badge badge-deprecated" title={m.deprecatedReason ?? undefined}>
      deprecated
    </span>
  );
}

export function VariantBadges({ v }: { v: Variant }) {
  const badges = [v.default && "default", v.isOptimized && "optimized", v.isBaseline && "baseline"].filter(Boolean) as string[];
  return (
    <>
      {badges.map((b) => (
        <span key={b} className={`badge badge-${b}`}>
          {b}
        </span>
      ))}
    </>
  );
}

// id and badges on one line. The id links to the variant's source, pinned to
// a commit, when there is one.
export function VariantLine({ v, cls }: { v: Variant; cls: string }) {
  return (
    <div className={cls}>
      {v.source ? (
        <a className="variant-id variant-src" href={v.source} {...NEW_TAB} title={`Source on GitHub, pinned to commit ${v.source.split("/blob/")[1].slice(0, 7)}`}>
          {v.id}
        </a>
      ) : (
        <span className="variant-id">{v.id}</span>
      )}
      <VariantBadges v={v} />
    </div>
  );
}

export function chartCode(v: Variant) {
  return v.chart && v.chart.name ? <code>{`${v.chart.name}${v.chart.version ? ` ${v.chart.version}` : ""}`}</code> : null;
}

export function imageCode(v: Variant) {
  return v.image && v.image.repository ? <code>{`${v.image.repository}${v.image.tag ? `:${v.image.tag}` : ""}`}</code> : null;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const highlight = (label: string) => <span className={`gpu hue-${gpuHue(label)}`}>{label}</span>;

// hardwareShort with each GPU name marked: "8 × <H100>", highlighted unless
// mark says otherwise. Labels are only GPU names when the variant names
// products; "any GPU" stays plain.
export function Hardware({ v, short = v.hardwareShort, mark = highlight }: { v: Variant; short?: string; mark?: (label: string) => ReactNode }) {
  const labels = v.hardware.filter((label) => label !== "any GPU");
  return (
    <>
      {short.split(/( × | \/ )/).map((part, i) => (
        <Fragment key={i}>{labels.includes(part) ? mark(part) : part}</Fragment>
      ))}
    </>
  );
}

// An optimized variant's bar and best number, drawn against scale, the best
// result in view; null for any other variant.
export function improvementBar(m: Model, v: Variant, scale: number, cls: string): ReactElement | null {
  const b = variantBest(m, v.id);
  if (!b) return null;
  const width = Math.max(0, Math.min(100, (b.upliftPct / scale) * 100));
  const title =
    (b.of > 1 ? `Best of ${b.of} workloads: ` : "") +
    `${b.upliftLabel}${b.name ? ` at ${b.name} tokens` : ""}, ${v.id} vs ${b.t.baselineId}, measured on v${b.t.version}. ` +
    UPLIFT_HELP;
  return (
    <div className={`imp ${cls}`} title={title}>
      <span className="imp-track">
        <span className="imp-fill" style={{ width: `${width.toFixed(1)}%` }}></span>
      </span>
      <span className="imp-val">{b.upliftLabel}</span>
    </div>
  );
}

export interface LinkItem {
  // The variant it belongs to: a report's tuned variant, a link's own.
  id: string | null;
  el: ReactElement;
}

// Perf reports, then any variants[].link, linked from the site's root, where
// the list pages sit.
export function linkItems(m: Model, cls: string, reportLabel: string): LinkItem[] {
  const items: LinkItem[] = reportLinks(m, reportLabel).map(({ r, id, title, text }) => ({
    id,
    el: (
      <a key={r.path} className={cls} href={encodePath(r.path) + REPORT_LANG} title={title} {...NEW_TAB}>
        {icons.report}
        {text}
      </a>
    ),
  }));
  for (const v of m.versions[0].variants) {
    if (!v.link) continue;
    items.push({
      id: v.id,
      el: (
        <a key={`link:${v.id}`} className={cls} href={v.link} {...NEW_TAB}>
          {icons.external}
          {v.id}
        </a>
      ),
    });
  }
  return items;
}

// The hardware filter: one toggle per GPU, grouped by gpuGroup, most first
// within a group. Checkboxes: anything on any checked GPU matches. counts is
// per GPU; what says what is counted, for the tooltip.
export function GpuToggles({
  counts,
  what,
  checked,
  onToggle,
}: {
  counts: Record<string, number>;
  what: string;
  checked: string[];
  onToggle: (label: string, on: boolean) => void;
}) {
  const labels = Object.keys(counts).sort((a, b) => gpuGroup(a) - gpuGroup(b) || counts[b] - counts[a] || a.localeCompare(b));
  return (
    <fieldset className="gpu-filter">
      <legend className="sr-only">GPU</legend>
      <span className="gpu-filter-label" aria-hidden="true">
        GPU
      </span>
      {labels.map((h) => (
        <label key={h} className={`toggle tint hue-${gpuHue(h)}`} title={`${what} ${h}`}>
          <input type="checkbox" name="hardware" value={h} checked={checked.includes(h)} onChange={(e) => onToggle(h, e.target.checked)} />
          {h}
          <span className="gpu-n">{counts[h]}</span>
        </label>
      ))}
    </fieldset>
  );
}

// A select's options: everything, then each value with its count.
export function Options({ values, all }: { values: string[]; all: string }) {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  return (
    <>
      <option value="">{all}</option>
      {Object.keys(counts)
        .sort((a, b) => a.localeCompare(b))
        .map((v) => (
          <option key={v} value={v}>
            {`${v} (${counts[v]})`}
          </option>
        ))}
    </>
  );
}

function Stat({ label, value, sub, cls }: { label: string; value: ReactNode; sub?: string; cls?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${cls ? " " + cls : ""}`}>{value}</div>
      <div className="stat-sub">{sub || ""}</div>
    </div>
  );
}

export function Summary({ items }: { items: Facet[] }) {
  const s = computeSummary(items);
  const pct = (x: number) => "+" + (Math.round(x * 10) / 10).toFixed(1) + "%";
  const counts = (o: Record<string, number>) =>
    Object.keys(o)
      .sort((a, b) => o[b] - o[a] || a.localeCompare(b))
      .map((k) => `${k} ${o[k]}`)
      .join(" · ");
  return (
    <section id="summary" className="summary" aria-label="Summary" aria-live="polite">
      <Stat label="Models" value={s.models} sub={s.deprecated ? `${s.deprecated} deprecated` : ""} />
      <Stat label="Variants" value={s.variants} sub={counts(s.engines)} />
      <Stat label="Optimized pairs" value={s.pairs} sub={s.models ? `${Math.round((s.pairs / s.models) * 100)}% of models` : ""} />
      <Stat
        label="Median improvement"
        value={s.median == null ? "—" : pct(s.median)}
        sub={s.median == null ? "" : `${pct(s.worst!.pct)} to ${pct(s.best!.pct)}`}
        cls={s.median == null ? "" : "pos"}
      />
      <Stat label="Best improvement" value={s.best ? pct(s.best.pct) : "—"} sub={s.best ? s.best.name : ""} cls={s.best ? "pos" : ""} />
    </section>
  );
}
