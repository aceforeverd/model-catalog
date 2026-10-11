// The catalog's lists: the models (/) and the variants (/variants.html).
// Both have the same summary, filters, and card and table views over the
// list's entries; the filters live in the URL, so a view can be shared, and
// carry over to the other list.
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import type { Catalog } from "@/types";
import { latestVersion } from "@/lib/catalog";
import { countBy, sortDir, sorters, type Facet } from "@/lib/facets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GpuToggles, Options, Summary } from "./catalog";
import { icons } from "./icons";
import { ListTabs, SiteFooter, SiteHeader } from "./site";

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

export type SortHead = (col: string, label: string, opts?: { className?: string; title?: string; sub?: string }) => ReactElement;

export interface ListConfig {
  noun: string;
  facets: Facet[];
  search: string;
  sorts: Array<[string, string]>;
  // What a GPU toggle counts, for its tooltip.
  gpuWhat: string;
  // The card grid's narrowest column.
  cardWidth: number;
  head: (th: SortHead) => ReactNode;
  card: (i: number) => ReactElement;
  row: (i: number) => ReactElement;
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

const field = "max-[560px]:flex max-[560px]:flex-[1_1_calc(50%-0.25rem)]";
const fieldSelect = "max-[560px]:w-full";

export function ListPage({ catalog, cfg }: { catalog: Catalog; cfg: ListConfig }) {
  const { facets, noun } = cfg;
  const html = document.documentElement;
  const [params, setParams] = useSearchParams();
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

  // From the URL; a value no control offers is dropped. The boot script in
  // index.html already picked the view from the URL or storage.
  const [st, setSt] = useState<State>(() => {
    const pick = (k: string, allowed: string[], fallback: string) => {
      const v = params.get(k);
      return v != null && allowed.includes(v) ? v : fallback;
    };
    return {
      q: params.get("q") ?? "",
      family: pick("family", ["", ...options.family], ""),
      engine: pick("engine", ["", ...options.engine], ""),
      tag: pick("tag", ["", ...options.tag], ""),
      hidedep: hasDeprecated && params.get("hidedep") === "1",
      sort: pick("sort", cfg.sorts.map(([v]) => v), DEFAULTS.sort),
      view: pick("view", ["cards", "table"], html.dataset.view === "cards" ? "cards" : "table") as View,
      hardware: params.getAll("hardware").filter((h) => h in options.hardware),
    };
  });
  const set = (patch: Partial<State>) => setSt((s) => ({ ...s, ...patch }));

  const qs = queryOf(st);
  useEffect(() => {
    html.dataset.view = st.view;
    if (qs !== params.toString()) setParams(qs, { replace: true, preventScrollReset: true });
  }, [qs, st.view]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const shown = order.filter((i) => matches(facets[i], st));

  // Tag, family and GPU chips set their filter; table headers set the sort.
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

  const th: SortHead = (col, label, { className, title, sub } = {}) => {
    const dir = col === st.sort ? sortDir[col] : undefined;
    return (
      <TableHead aria-sort={dir} className={className} title={title}>
        <Button variant="bare" size="none" data-sort={col} className={cn("hover:text-foreground", dir && "text-foreground")}>
          {label}
          <span className="inline-block w-[0.7em]" aria-hidden="true">
            {dir === "ascending" ? "↑" : dir === "descending" ? "↓" : ""}
          </span>
        </Button>
        {sub && <span className="mt-[0.1rem] block text-[0.68rem] font-normal text-faint">{sub}</span>}
      </TableHead>
    );
  };

  const variants = catalog.models.reduce((n, m) => n + latestVersion(m).variants.length, 0);
  const select = (name: "family" | "engine" | "tag", all: string) => (
    <label className={field}>
      <span className="sr-only">{name[0].toUpperCase() + name.slice(1)}</span>
      <NativeSelect name={name} value={st[name]} onChange={(e) => set({ [name]: e.target.value })} className={fieldSelect}>
        <Options values={options[name]} all={all} />
      </NativeSelect>
    </label>
  );

  return (
    <>
      <SiteHeader eyebrow="modelsphere / model-catalog" title="Model catalog" subject="these models" />
      <main className="wrap">
        <ListTabs query={qs ? `?${qs}` : ""} models={catalog.count} variants={variants} />
        <Summary items={shown.map((i) => facets[i])} />
        <form
          role="search"
          ref={form}
          onSubmit={(e) => e.preventDefault()}
          className="sticky top-0 z-[5] mb-2 grid gap-[0.6rem] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] py-3 backdrop-blur-[10px]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-[1_1_280px]">
              <span className="sr-only">Search {noun}</span>
              <Input
                type="search"
                name="q"
                placeholder={cfg.search}
                autoComplete="off"
                ref={search}
                value={st.q}
                onChange={(e) => set({ q: e.target.value })}
                className="peer"
              />
              <Kbd aria-hidden="true" className="absolute top-1/2 right-[0.6rem] -translate-y-1/2 peer-focus:hidden peer-[:not(:placeholder-shown)]:hidden">
                /
              </Kbd>
            </label>
            {select("family", "All families")}
            {select("engine", "All engines")}
            {select("tag", "All tags")}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasDeprecated && (
              <Toggle className="hue-red" pressed={st.hidedep} onPressedChange={(on) => set({ hidedep: on })}>
                Hide deprecated
              </Toggle>
            )}
            <span className="flex-[1_1_auto] max-[560px]:hidden"></span>
            <p aria-live="polite" className="mx-1 text-[0.85rem] text-muted-foreground tabular-nums">
              {shown.length === facets.length ? `${facets.length} ${noun}` : `${shown.length} of ${facets.length} ${noun}`}
            </p>
            <label className={field}>
              <span className="sr-only">Sort by</span>
              <NativeSelect name="sort" value={st.sort} onChange={(e) => set({ sort: e.target.value })} className={fieldSelect}>
                {cfg.sorts.map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <ToggleGroup
              type="single"
              variant="segment"
              aria-label="View"
              value={st.view}
              onValueChange={(value: string) => {
                if (value !== "cards" && value !== "table") return;
                try {
                  localStorage.setItem("view", value);
                } catch {
                  // Storage unavailable: the view still applies for this visit.
                }
                set({ view: value });
              }}
            >
              <ToggleGroupItem value="cards" title="Card view">
                {icons.cards}
                <span>Cards</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="table" title="Table view">
                {icons.table}
                <span>Table</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GpuToggles counts={options.hardware} what={cfg.gpuWhat} selected={st.hardware} onChange={(hardware) => set({ hardware })} />
            <span className="flex-[1_1_auto] max-[560px]:hidden"></span>
            <Button
              type="button"
              variant="ghost"
              size="none"
              className="px-[0.35rem] py-[0.4rem] text-[0.85rem]"
              // Reset clears the filters but keeps the view.
              onClick={() => set({ q: "", family: "", engine: "", tag: "", hidedep: false, sort: DEFAULTS.sort, hardware: [] })}
            >
              Reset
            </Button>
          </div>
        </form>
        <div onClick={onResultsClick}>
          {st.view === "cards" ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${cfg.cardWidth}px), 1fr))` }}>
              {shown.map((i) => cfg.card(i))}
            </div>
          ) : (
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>{cfg.head(th)}</TableRow>
              </TableHeader>
              <TableBody>{shown.map((i) => cfg.row(i))}</TableBody>
            </Table>
          )}
        </div>
        {shown.length === 0 && (
          <p className="rounded-2xl border border-dashed border-input px-4 py-12 text-center text-muted-foreground">No {noun} match these filters.</p>
        )}
      </main>
      <SiteFooter>
        Generated from <code>models/</code> by <code>npm run build:site</code>. This site is also the catalog swiss reads:{" "}
        <a href={`${import.meta.env.BASE_URL}index.json`}>index.json</a>.
      </SiteFooter>
    </>
  );
}
