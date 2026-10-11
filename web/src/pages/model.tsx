// A model's page: models/<name>/index.html. Every variant of the version a
// deploy gets, in full. Tuning binds to the optimized variant: a model may
// have several, each against its own baseline, so each optimized variant
// carries its own results.
import { Fragment, useEffect, useState } from "react";
import type { Model, Tuning, Variant, Version } from "../types";
import { anchorOf, latestVersion, orderedVariants, reportLinks, REPORT_LANG, tuningFor, UPLIFT_HELP, variantYaml, WORKLOAD_NAMES } from "../lib/catalog";
import { countBy } from "../lib/facets";
import { tagHue } from "../lib/hues";
import { chartCode, DeprecatedBadge, Fact, GpuToggles, Hardware, imageCode, NEW_TAB, VariantBadges } from "../components/bits";
import { SiteFooter, SiteHeader } from "../components/chrome";
import { icons } from "../components/icons";

const HOME = "../../index.html";

// A pair's baseline: linked when this version has it -- a pair carried from
// an earlier version may name one this version dropped.
function BaselineRef({ ver, t }: { ver: Version; t: Tuning }) {
  const code = <code>{t.baselineId}</code>;
  return ver.variants.some((v) => v.id === t.baselineId) ? <a href={`#${anchorOf(ver.version, t.baselineId)}`}>{code}</a> : code;
}

// One bar per workload, drawn against the model's largest result so bars
// compare across its variants. The best row is bold; a regression draws no bar.
//   Agent long-context  ██████████  +64.2%
//   Document QA         █            +7.6%
function TuningBars({ t, scale }: { t: Tuning; scale: number }) {
  const rows = t.workloads.length
    ? t.workloads
    : t.upliftPct == null
      ? []
      : [{ name: "headline", upliftPct: t.upliftPct, upliftLabel: t.upliftLabel! }];
  const best = Math.max(...rows.map((w) => w.upliftPct));
  return (
    <div className="tn-bars" title={UPLIFT_HELP}>
      {rows.map((w) => {
        const width = Math.max(0, Math.min(100, (w.upliftPct / scale) * 100));
        const named = WORKLOAD_NAMES[w.name];
        return (
          <div key={w.name} className={`tn-row${w.upliftPct === best ? " tn-best" : ""}`} title={named ? `${w.name} tokens, in + out` : undefined}>
            <span className="tn-label">{named || w.name}</span>
            <span className="tn-track">
              <span className="tn-fill" style={{ width: `${width.toFixed(1)}%` }}></span>
            </span>
            <span className="tn-val">{w.upliftLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function TuningBlock({ ver, t, scale }: { ver: Version; t: Tuning; scale: number }) {
  const older = t.version !== ver.version ? t.version : null;
  return (
    <div className="tn">
      <div className="tn-head">
        <span>
          Improvement vs <BaselineRef ver={ver} t={t} />
          <span className="tn-sub"> · per workload</span>
        </span>
        {t.reportFile && (
          <a className="tn-report" href={encodeURIComponent(t.reportFile) + REPORT_LANG} title={older ? `Measured on v${older}` : undefined} {...NEW_TAB}>
            {icons.report}Perf report
          </a>
        )}
      </div>
      <TuningBars t={t} scale={scale} />
    </div>
  );
}

function VariantDetail({ m, ver, v, scale, yaml, hidden }: { m: Model; ver: Version; v: Variant; scale: number; yaml: string | null; hidden: boolean }) {
  const anchor = anchorOf(ver.version, v.id);
  const pairs = tuningFor(m, ver.version, v.id);
  // Optimized variants of this version measured against this one.
  const against = ver.variants.filter((o) => tuningFor(m, ver.version, o.id).some((t) => t.baselineId === v.id));
  return (
    <article className="vd" id={anchor} data-gpus={v.hardware.join("|")} hidden={hidden}>
      <div className="vd-head">
        <h3 className="vd-id">
          <a href={`#${anchor}`}>{v.id}</a>
        </h3>
        <VariantBadges v={v} />
        <span className="vd-actions">
          {v.link && (
            <a className="btn btn-sm" href={v.link} {...NEW_TAB}>
              {icons.external}Link
            </a>
          )}
          {v.source && (
            <a className="btn btn-sm" href={v.source} {...NEW_TAB} title={`Pinned to commit ${v.source.split("/blob/")[1].slice(0, 7)}`}>
              {icons.external}Source
            </a>
          )}
        </span>
      </div>
      {v.description && <p className="vd-desc">{v.description}</p>}
      <dl className="vd-facts">
        <Fact label="Engine">{v.engine}</Fact>
        <Fact label="Hardware">
          {v.hardwareShort && (
            <>
              <Hardware v={v} />
              <span className="vd-faint"> · {v.requiresSummary}</span>
            </>
          )}
        </Fact>
        <Fact label="Chart">{chartCode(v)}</Fact>
        <Fact label="Image">{imageCode(v)}</Fact>
      </dl>
      {pairs.map((t) => (
        <TuningBlock key={`${t.version}:${t.baselineId}:${t.reportFile}`} ver={ver} t={t} scale={scale} />
      ))}
      {against.length > 0 && (
        <p className="vd-baseline">
          Baseline for{" "}
          {against.map((o, i) => (
            <Fragment key={o.id}>
              {i > 0 && ", "}
              <a href={`#${anchorOf(ver.version, o.id)}`}>
                <code>{o.id}</code>
              </a>
            </Fragment>
          ))}
        </p>
      )}
      {yaml && (
        <details className="vd-config">
          <summary>Configuration</summary>
          <pre>
            <code>{yaml}</code>
          </pre>
        </details>
      )}
    </article>
  );
}

// Checked GPU toggles show only the variants that run on one of them; the
// choice lives in the URL beside the fragment.
function useGpuFilter(variants: Variant[]) {
  const labels = new Set(variants.flatMap((v) => v.hardware));
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).getAll("hardware").filter((h) => labels.has(h)));
  useEffect(() => {
    const params = new URLSearchParams();
    for (const h of selected) params.append("hardware", h);
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash);
  }, [selected]);
  const shows = (v: Variant) => !selected.length || selected.some((h) => v.hardware.includes(h));
  const toggle = (h: string, on: boolean) => setSelected((s) => (on ? [...s, h] : s.filter((x) => x !== h)));
  return { selected, shows, toggle };
}

export function ModelPage({ m, versionText }: { m: Model; versionText: string | null }) {
  const latest = latestVersion(m);
  const variants = orderedVariants(m, latest.variants);
  const gpus = useGpuFilter(latest.variants);
  // The fragment named a variant before there was one to scroll to.
  useEffect(() => {
    if (location.hash) location.replace(location.href);
  }, []);

  const all = latest.variants
    .flatMap((v) => tuningFor(m, latest.version, v.id))
    .flatMap((t) => (t.workloads.length ? t.workloads.map((w) => w.upliftPct) : [t.upliftPct]));
  const scale = Math.max(0, ...all.filter((x): x is number => x != null)) || 1;
  const hf = m.source && m.source.hf;
  const filterLink = (field: string, value: string, cls: string) => (
    <a key={value} className={cls} href={`${HOME}?${field}=${encodeURIComponent(value)}`} title={`All models with ${field} ${value}`}>
      {value}
    </a>
  );
  const reports = reportLinks(m, "Perf report");
  const total = latest.variants.length;
  const shown = latest.variants.filter(gpus.shows).length;
  const noun = total === 1 ? "variant" : "variants";

  return (
    <>
      <SiteHeader
        eyebrow={
          <>
            <a href={HOME}>model-catalog</a> / {m.name}
          </>
        }
        title={
          <>
            {m.displayName} <DeprecatedBadge m={m} />
          </>
        }
        subject="this model"
      />
      <main className="wrap mp">
        <section className="mp-about">
          <div className="model-meta">
            <code>{m.name}</code>
            {m.family && filterLink("family", m.family, "chip")}
            {hf && (
              <>
                <a href={`https://huggingface.co/${hf}`} {...NEW_TAB}>
                  <code>{hf}</code>
                </a>
                {m.source!.revision && (
                  <>
                    {" @ "}
                    <code>{m.source!.revision}</code>
                  </>
                )}
              </>
            )}
          </div>
          {m.tags.length > 0 && <div className="mp-tags">{m.tags.map((t) => filterLink("tag", t, `chip hue-${tagHue(t)}`))}</div>}
          {m.deprecatedReason && <p className="mp-dep">Deprecated: {m.deprecatedReason}</p>}
          {m.description && <p className="mp-desc">{m.description}</p>}
          {reports.length > 0 && (
            <div className="links">
              {reports.map(({ r, title, text }) => (
                <a key={r.file} className="btn" href={encodeURIComponent(r.file) + REPORT_LANG} title={title} {...NEW_TAB}>
                  {icons.report}
                  {text}
                </a>
              ))}
            </div>
          )}
          <form id="gpu-select" onSubmit={(e) => e.preventDefault()}>
            <GpuToggles
              counts={countBy(latest.variants.flatMap((v) => [...new Set(v.hardware)]))}
              what="Variants for"
              checked={gpus.selected}
              onToggle={gpus.toggle}
            />
          </form>
        </section>
        <section className="ver" id={`v${latest.version}`}>
          <div className="ver-head">
            <h2>Variants</h2>
            <span className="ver-meta">
              <span id="variant-count">{gpus.selected.length ? `${shown} of ${total} ${noun}` : `${total} ${noun}`}</span>
              {latest.servedName && (
                <>
                  {" · served as "}
                  <code>{latest.servedName}</code>
                </>
              )}
            </span>
            {latest.source && (
              <a className="ver-src" href={latest.source} {...NEW_TAB}>
                {icons.external}
                {latest.path.split("/").pop()}
              </a>
            )}
          </div>
          <div className="ver-body">
            {variants.map((v) => (
              <VariantDetail
                key={v.id}
                m={m}
                ver={latest}
                v={v}
                scale={scale}
                yaml={versionText && v.lines ? variantYaml(versionText, v.lines) : null}
                hidden={!gpus.shows(v)}
              />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter>
        Generated from <code>models/{m.dir}/</code> by <code>npm run build:site</code>.
      </SiteFooter>
    </>
  );
}
