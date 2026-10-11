// What every page has around its content: the header, with the theme button,
// and the footer.
import { useState, type ReactNode } from "react";
import { icons } from "./icons";

type Theme = "system" | "light" | "dark";
const THEMES: Theme[] = ["system", "light", "dark"];

// Cycles system -> light -> dark. The choice is stored per browser; the boot
// script in each page's <head> applies it before first paint.
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
    <button type="button" id="theme-toggle" className="theme-toggle" title={`Theme: ${theme} (click to change)`} onClick={next}>
      {THEMES.map((t) => (
        <span key={t} data-icon={t} hidden={t !== theme}>
          {icons[t]}
        </span>
      ))}
      <span className="theme-label">{theme[0].toUpperCase() + theme.slice(1)}</span>
    </button>
  );
}

// Where to go to deploy, under each page's title: modelsphere is the complete
// deployment solution.
function DeployRef({ subject }: { subject: string }) {
  return (
    <p className="deploy-ref">
      Deploying {subject}? Start with{" "}
      <a href="https://github.com/modelsphere/modelsphere" target="_blank" rel="noopener">
        <code>modelsphere/modelsphere</code>
        {icons.external}
      </a>
      , the complete deployment solution.
    </p>
  );
}

export function SiteHeader({ eyebrow, title, subject }: { eyebrow: ReactNode; title: ReactNode; subject: string }) {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <DeployRef subject={subject} />
        </div>
        <ThemeButton />
      </div>
    </header>
  );
}

export function SiteFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="wrap">
      <p>{children}</p>
    </footer>
  );
}
