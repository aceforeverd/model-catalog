// What every page has around its content: the header, with the theme
// button, and the footer; and the lists' tabs.
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { icons } from "./icons";

type Theme = "system" | "light" | "dark";
const THEMES: Theme[] = ["system", "light", "dark"];

// Cycles system -> light -> dark. The choice is stored per browser; the boot
// script in index.html applies it before first paint.
function ThemeButton() {
  const html = document.documentElement;
  const [theme, setTheme] = useState<Theme>(() => (html.dataset.theme as Theme) || "system");
  const next = () => {
    const t = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    if (t === "system") delete html.dataset.theme;
    else html.dataset.theme = t;
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
    setTheme(t);
  };
  return (
    <Button
      type="button"
      id="theme-toggle"
      title={`Theme: ${theme} (click to change)`}
      onClick={next}
      className="gap-[0.4rem] px-3 py-[0.4rem] text-[0.85rem] text-muted-foreground hover:border-input hover:text-foreground [&_svg]:size-4"
    >
      {THEMES.map((t) => (
        <span key={t} data-icon={t} hidden={t !== theme} className="inline-flex">
          {icons[t]}
        </span>
      ))}
      <span className="max-[560px]:hidden">{theme[0].toUpperCase() + theme.slice(1)}</span>
    </Button>
  );
}

// Where to go to deploy, under each page's title: modelsphere is the complete
// deployment solution.
function DeployRef({ subject }: { subject: string }) {
  return (
    <p className="mt-[0.6rem] text-[0.92rem] text-muted-foreground">
      Deploying {subject}? Start with{" "}
      <a href="https://github.com/modelsphere/modelsphere" target="_blank" rel="noopener" className="font-[650] whitespace-nowrap">
        <code>modelsphere/modelsphere</code>
        <span className="ml-[0.2em] inline-block size-[0.85em] align-[-0.05em] [&_svg]:size-full">{icons.external}</span>
      </a>
      , the complete deployment solution.
    </p>
  );
}

export function SiteHeader({ eyebrow, title, subject }: { eyebrow: ReactNode; title: ReactNode; subject: string }) {
  return (
    <header className="pt-9 pb-5 max-[560px]:pt-6">
      <div className="wrap flex items-start justify-between gap-4">
        <div>
          <p className="mb-[0.35rem] text-[0.75rem] tracking-[0.08em] text-muted-foreground uppercase [&_a]:text-inherit">{eyebrow}</p>
          <h1 className="text-[clamp(1.6rem,3vw,2.1rem)] leading-[1.15] font-bold tracking-[-0.02em]">{title}</h1>
          <DeployRef subject={subject} />
        </div>
        <ThemeButton />
      </div>
    </header>
  );
}

export function SiteFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="wrap pt-10 pb-12 text-[0.84rem] text-faint">
      <p>{children}</p>
    </footer>
  );
}

// The lists' tabs. Each carries the filters over, so the other list opens on
// the same ones; a sort it lacks falls back.
export function ListTabs({ query, models, variants }: { query: string; models: number; variants: number }) {
  const tab = (to: string, label: string, n: number) => (
    <NavLink
      to={{ pathname: to, search: query }}
      end
      className="-mb-px inline-flex items-baseline gap-[0.4rem] border-b-2 border-transparent px-[0.85rem] py-[0.45rem] font-semibold text-muted-foreground hover:text-foreground hover:no-underline aria-[current=page]:border-primary aria-[current=page]:text-foreground"
    >
      {label}
      <span className="text-[0.8rem] font-medium text-faint tabular-nums">{n}</span>
    </NavLink>
  );
  return (
    <nav className="mb-4 flex gap-1 border-b border-border" aria-label="Catalog">
      {tab("/", "Models", models)}
      {tab("/variants.html", "Variants", variants)}
    </nav>
  );
}
