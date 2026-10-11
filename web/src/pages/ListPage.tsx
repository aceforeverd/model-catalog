// The catalog's lists, a page each: models (index.html) and variants
// (variants.html). Both have the same summary, filters, card and table views
// over the page's entries; the filters live in the URL, so a view can be
// shared, and carry over to the other list.
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import type { Catalog } from "../types";
import { latestVersion } from "../lib/catalog";
import { countBy, sortDir, sorters, type Facet } from "../lib/facets";
import { GpuToggles, Options, Summary } from "../components/bits";
import { SiteFooter, SiteHeader } from "../components/chrome";
import { icons } from "../components/icons";

type View = "cards" | "table";

interface State {
  q: string;
  family: string;
  engine: string;
  tag: string;
  hidedep: boolean;
  sort: string;
  view: View;
  hardware: string[];
}

const DEFAULTS = { sort: "uplift", view: "table" };

export type SortTh = (col: string, label: string, opts?: { cls?: string; title?: string; sub?: string }) => ReactElement;

export interface ListConfig {
  page: "models" | "variants";
  noun: string;
  facets: Facet[];
  search: string;
  sorts: Array<[string, string]>;
  // What a GPU toggle counts, for its tooltip.
  gpuWhat: string;
  head: (th: SortTh) => ReactNode;
  card: (i: number, hidden: boolean) => ReactElement;
  row: (i: number, hidden: boolean) => ReactElement;
}

function matches(m: Facet, st: State): boolean {
  const terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.every((t) => m.text.includes(t))) return false;
  if (st.family && m.family !== st.family) return false;
  if (st.engine && !m.engines.includes(st.engine)) return false;
  if (st.hardware.length && !st.hardware.some((h) => m.hardware.includes(h))) return false;
  if (st.tag && !m.tags.includes(st.tag)) return false;
  if (st.hidedep && m.deprecated) return false;
  return true;
}

// The query string for a state: what differs from the defaults.
function queryOf(st: State): string {
  const params = new URLSearchParams();
  for (const k of ["q", "family", "engine", "tag", "hidedep", "sort", "view"] as const) {
    const v = st[k];
    if (v === true) params.set(k, "1");
    else if (v && v !== DEFAULTS[k as keyof typeof DEFAULTS]) params.set(k, v);
  }
  for (const h of st.hardware) params.append("hardware", h);
  return params.toString();
}

export function ListPage({ catalog, cfg }: { catalog: Catalog; cfg: ListConfig }) {
  const { facets, noun } = cfg;
  const html = document.documentElement;
  const options = useMemo(
    () => ({
      family: facets.map((f) => f.family).filter((f): f is string => !!f),
      engine: facets.flatMap((f) => [...new Set(f.engines)]),
      tag: facets.flatMap((f) => f.tags),
      hardware: countBy(facets.flatMap((f) => f.hardware)),
    }),
    [facets]
  );
  const hasDeprecated = facets.some((f) => f.deprecated);

  // From the URL; a value no control offers is dropped. The <head> boot
  // script already picked the view from the URL or storage.
  const [st, setSt] = useState<State>(() => {
    const params = new URLSearchParams(location.search);
    const pick = (k: string, allowed: string[], fallback: string) => {
      const v = params.get(k);
      return v != null && allowed.includes(v) ? v : fallback;
    };
    const view = html.dataset.view === "cards" ? "cards" : "table";
    return {
      q: params.get("q") ?? "",
      family: pick("family", ["", ...options.family], ""),
      engine: pick("engine", ["", ...options.engine], ""),
      tag: pick("tag", ["", ...options.tag], ""),
      hidedep: hasDeprecated && params.get("hidedep") === "1",
      sort: pick("sort", cfg.sorts.map(([v]) => v), DEFAULTS.sort),
      view: pick("view", ["cards", "table"], view) as View,
      hardware: params.getAll("hardware").filter((h) => h in options.hardware),
    };
  });
  const set = (patch: Partial<State>) => setSt((s) => ({ ...s, ...patch }));

  const qs = queryOf(st);
  useEffect(() => {
    html.dataset.view = st.view;
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }, [qs, st.view, html]);

  // "/" focuses the search; Escape clears it.
  const search = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = document.activeElement;
      if (e.key === "/" && !/^(INPUT|SELECT|TEXTAREA)$/.test(t?.tagName ?? "")) {
        e.preventDefault();
        search.current?.focus();
      } else if (e.key === "Escape" && t === search.current && search.current?.value) {
        set({ q: "" });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sorter = sorters[st.sort] || sorters[DEFAULTS.sort];
  const order = facets.map((_, i) => i).sort((a, b) => sorter(facets[a], facets[b]));
  const visible = facets.map((f) => matches(f, st));
  const shown = order.filter((i) => visible[i]).map((i) => facets[i]);

  // Tag and family chips set the matching filter; a GPU chip adds its GPU.
  // Table headers set the sort.
  const onResultsClick = (e: MouseEvent) => {
    const target = e.target as Element;
    const chip = target.closest<HTMLElement>("[data-filter]");
    if (chip) {
      const { filter, value = "" } = chip.dataset;
      if (filter === "hardware") {
        if (value in options.hardware && !st.hardware.includes(value)) set({ hardware: [...st.hardware, value] });
      } else if (filter === "family" || filter === "engine" || filter === "tag") {
        if (options[filter].includes(value)) set({ [filter]: value });
      }
      form.current?.scrollIntoView({ block: "nearest" });
      return;
    }
    const sort = target.closest<HTMLElement>("[data-sort]");
    if (sort) set({ sort: sort.dataset.sort });
  };

  const th: SortTh = (col, label, { cls, title, sub } = {}) => (
    <th scope="col" data-sort-col={col} aria-sort={col === st.sort ? sortDir[col] : undefined} className={cls} title={title}>
      <button type="button" className="sort-btn" data-sort={col}>
        {label}
        <span className="sort-ind" aria-hidden="true"></span>
      </button>
      {sub && <span className="th-sub">{sub}</span>}
    </th>
  );

  const variants = catalog.models.reduce((n, m) => n + latestVersion(m).variants.length, 0);
  const tab = (key: ListConfig["page"], href: string, label: string, n: number) => (
    <a href={href + (qs ? `?${qs}` : "")} data-carry="" aria-current={key === cfg.page ? "page" : undefined}>
      {label}
      <span className="nav-n">{n}</span>
    </a>
  );

  return (
    <>
      <SiteHeader eyebrow="modelsphere / model-catalog" title="Model catalog" subject="these models" />
      <main className="wrap">
        <nav className="page-nav" aria-label="Catalog">
          {tab("models", "index.html", "Models", catalog.count)}
          {tab("variants", "variants.html", "Variants", variants)}
        </nav>
        <Summary items={shown} />
        <form
          id="filters"
          className="toolbar"
          role="search"
          ref={form}
          onSubmit={(e) => e.preventDefault()}
          // Reset clears the filters but keeps the view.
          onReset={(e) => {
            e.preventDefault();
            set({ q: "", family: "", engine: "", tag: "", hidedep: false, sort: DEFAULTS.sort, hardware: [] });
          }}
        >
          <div className="toolbar-row">
            <label className="search">
              <span className="sr-only">Search {noun}</span>
              <input type="search" name="q" placeholder={cfg.search} autoComplete="off" ref={search} value={st.q} onChange={(e) => set({ q: e.target.value })} />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <label>
              <span className="sr-only">Family</span>
              <select name="family" value={st.family} onChange={(e) => set({ family: e.target.value })}>
                <Options values={options.family} all="All families" />
              </select>
            </label>
            <label>
              <span className="sr-only">Engine</span>
              <select name="engine" value={st.engine} onChange={(e) => set({ engine: e.target.value })}>
                <Options values={options.engine} all="All engines" />
              </select>
            </label>
            <label>
              <span className="sr-only">Tag</span>
              <select name="tag" value={st.tag} onChange={(e) => set({ tag: e.target.value })}>
                <Options values={options.tag} all="All tags" />
              </select>
            </label>
          </div>
          <div className="toolbar-row">
            {hasDeprecated && (
              <label className="toggle tint tint-bad">
                <input type="checkbox" name="hidedep" checked={st.hidedep} onChange={(e) => set({ hidedep: e.target.checked })} />
                Hide deprecated
              </label>
            )}
            <span className="toolbar-spacer"></span>
            <p id="result-count" className="result-count" aria-live="polite">
              {shown.length === facets.length ? `${facets.length} ${noun}` : `${shown.length} of ${facets.length} ${noun}`}
            </p>
            <label>
              <span className="sr-only">Sort by</span>
              <select name="sort" value={st.sort} onChange={(e) => set({ sort: e.target.value })}>
                {cfg.sorts.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="segmented">
              <legend className="sr-only">View</legend>
              {(
                [
                  ["cards", "Card view", icons.cards, "Cards"],
                  ["table", "Table view", icons.table, "Table"],
                ] as const
              ).map(([value, title, icon, label]) => (
                <label key={value} title={title}>
                  <input
                    type="radio"
                    name="view"
                    value={value}
                    checked={st.view === value}
                    onChange={() => {
                      try {
                        localStorage.setItem("view", value);
                      } catch {
                        // Storage unavailable: the view still applies for this visit.
                      }
                      set({ view: value });
                    }}
                  />
                  {icon}
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </div>
          <div className="toolbar-row">
            <GpuToggles
              counts={options.hardware}
              what={cfg.gpuWhat}
              checked={st.hardware}
              onToggle={(h, on) => set({ hardware: on ? [...st.hardware, h] : st.hardware.filter((x) => x !== h) })}
            />
            <span className="toolbar-spacer"></span>
            <button type="reset" className="link-btn">
              Reset
            </button>
          </div>
        </form>
        <div id="results" data-noun={noun} onClick={onResultsClick}>
          <div id="cards" className={`models ${cfg.page}-cards`}>
            {order.map((i) => cfg.card(i, !visible[i]))}
          </div>
          <div className="table-view table-wrap">
            <table className="models-table">
              <thead>
                <tr>{cfg.head(th)}</tr>
              </thead>
              <tbody id="table-rows">{order.map((i) => cfg.row(i, !visible[i]))}</tbody>
            </table>
          </div>
        </div>
        <p id="empty" className="empty" hidden={shown.length > 0}>
          No {noun} match these filters.
        </p>
      </main>
      <SiteFooter>
        Generated from <code>models/</code> by <code>npm run build:site</code>. This site is also the catalog swiss reads:{" "}
        <a href="index.json">index.json</a>.
      </SiteFooter>
    </>
  );
}
