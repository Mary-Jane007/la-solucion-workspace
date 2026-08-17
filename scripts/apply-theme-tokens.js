const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "src", "styles.css");
let css = fs.readFileSync(file, "utf8");

const rootTokens = `:root {
  --color-bg: #020b1a;
  --color-bg-soft: #071329;
  --color-bg-elevated: #0b1b38;
  --color-accent: #e11d2f;
  --color-accent-hover: #f87171;
  --color-accent-soft: rgba(225, 29, 47, 0.15);
  --color-navy: #0f2547;
  --color-navy-soft: #142a4d;
  --color-text: #f9fafb;
  --color-text-muted: #9ca3af;
  --color-text-subtle: #e5e7eb;
  --color-link: #93c5fd;
  --color-border: rgba(148, 163, 184, 0.22);
  --color-border-strong: rgba(148, 163, 184, 0.45);
  --color-overlay: rgba(2, 6, 23, 0.55);
  --color-overlay-heavy: rgba(15, 23, 42, 0.85);
  --color-control-bg: rgba(15, 23, 42, 0.65);
  --color-control-bg-strong: rgba(15, 23, 42, 0.8);
  --color-item-bg: rgba(15, 23, 42, 0.35);
  --color-chip-bg: rgba(15, 23, 42, 0.7);
  --color-surface: #152238;
  --gradient-body: radial-gradient(circle at top left, #172554, #020617 40%, #000);
  --gradient-main: radial-gradient(circle at top, #0b1b38, #020617 55%);
  --gradient-sidebar: linear-gradient(165deg, #020617 0%, #071329 45%, #0b1b38 100%);
  --gradient-card: radial-gradient(circle at top left, #1e293b, #020617 60%);
  --gradient-card-soft: linear-gradient(145deg, #020617, #1e293b);
  --gradient-modal: radial-gradient(circle at top, #020617, #020617 70%);
  --gradient-hero: radial-gradient(circle at top left, #1e40af, #020617 55%, #000);
  --gradient-avatar: linear-gradient(145deg, #1d4ed8, #020617);
  --gradient-board: #020617;
  --gradient-calendar: linear-gradient(145deg, #020617, #111827);
  --color-success: #86efac;
  --color-success-bg: rgba(34, 197, 94, 0.18);
  --color-danger: #fca5a5;
  --color-danger-strong: #fecaca;
  --color-danger-bg: rgba(239, 68, 68, 0.18);
  --color-danger-bg-strong: rgba(127, 29, 29, 0.35);
  --color-warning: #fcd34d;
  --color-warning-bg: rgba(245, 158, 11, 0.2);
  --color-info: #93c5fd;
  --color-info-bg: rgba(96, 165, 250, 0.2);
  --color-unread-bg: rgba(127, 29, 29, 0.35);
  --color-unread-text: #fecaca;
  --color-unread-border: rgba(239, 68, 68, 0.55);
  --color-nav-active: #fecaca;
  --color-nav-hover-bg: rgba(148, 163, 184, 0.12);
  --color-hero-text: #e5e7eb;
  --color-table-line: rgba(148, 163, 184, 0.3);
  --color-fin-tab-active-bg: color-mix(in srgb, #2563eb 28%, transparent);
  --color-fin-tab-active-text: #dbeafe;
  --radius-lg: 18px;
  --radius-md: 12px;
  --shadow-soft: 0 20px 40px rgba(0, 0, 0, 0.45);
  --shadow-subtle: 0 8px 20px rgba(0, 0, 0, 0.3);
}`;

const lightTokens = `[data-theme="licht"] {
  --color-bg: #f3f4f6;
  --color-bg-soft: #ffffff;
  --color-bg-elevated: #ffffff;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-text-subtle: #374151;
  --color-accent-soft: rgba(225, 29, 47, 0.1);
  --color-link: #1d4ed8;
  --color-border: rgba(15, 23, 42, 0.1);
  --color-border-strong: rgba(15, 23, 42, 0.18);
  --color-overlay: rgba(15, 23, 42, 0.35);
  --color-overlay-heavy: rgba(15, 23, 42, 0.5);
  --color-control-bg: #ffffff;
  --color-control-bg-strong: #ffffff;
  --color-item-bg: #ffffff;
  --color-chip-bg: #f3f4f6;
  --color-surface: #ffffff;
  --gradient-body: radial-gradient(circle at top left, #e5e7eb, #f9fafb 45%, #f3f4f6);
  --gradient-main: radial-gradient(circle at top, #ffffff, #f3f4f6 60%);
  --gradient-sidebar: linear-gradient(145deg, #ffffff, #f9fafb 35%, #e5e7eb);
  --gradient-card: #ffffff;
  --gradient-card-soft: #f9fafb;
  --gradient-modal: #ffffff;
  --gradient-hero: radial-gradient(circle at top left, #dbeafe, #eff6ff 55%, #ffffff);
  --gradient-avatar: linear-gradient(145deg, #2563eb, #1e3a8a);
  --gradient-board: #f9fafb;
  --gradient-calendar: #ffffff;
  --color-success: #15803d;
  --color-success-bg: rgba(22, 163, 74, 0.12);
  --color-danger: #b91c1c;
  --color-danger-strong: #991b1b;
  --color-danger-bg: rgba(185, 28, 28, 0.1);
  --color-danger-bg-strong: #fef2f2;
  --color-warning: #c2410c;
  --color-warning-bg: rgba(217, 119, 6, 0.12);
  --color-info: #1d4ed8;
  --color-info-bg: rgba(37, 99, 235, 0.12);
  --color-unread-bg: #fef2f2;
  --color-unread-text: #991b1b;
  --color-unread-border: rgba(185, 28, 28, 0.4);
  --color-nav-active: #991b1b;
  --color-nav-hover-bg: rgba(15, 23, 42, 0.05);
  --color-hero-text: #1e3a8a;
  --color-table-line: rgba(15, 23, 42, 0.1);
  --color-fin-tab-active-bg: rgba(37, 99, 235, 0.14);
  --color-fin-tab-active-text: #1d4ed8;
  --shadow-soft: 0 16px 32px rgba(15, 23, 42, 0.08);
  --shadow-subtle: 0 6px 16px rgba(15, 23, 42, 0.06);
}`;

css = css.replace(/:root \{[\s\S]*?\n\}/, rootTokens);
css = css.replace(/\/\* Licht thema \*\/\n\[data-theme="licht"\] \{[\s\S]*?\n\}/, `/* Licht thema */\n${lightTokens}`);

const pairs = [
  ["background: radial-gradient(circle at top left, #172554, #020617 40%, #000);", "background: var(--gradient-body);"],
  ["background: radial-gradient(circle at top, #0b1b38, #020617 55%);", "background: var(--gradient-main);"],
  ["background: linear-gradient(165deg, #020617 0%, #071329 45%, #0b1b38 100%);", "background: var(--gradient-sidebar);"],
  ["background: radial-gradient(circle at top left, #1e293b, #020617 60%);", "background: var(--gradient-card);"],
  ["background: linear-gradient(145deg, #020617, #1e293b);", "background: var(--gradient-card-soft);"],
  ["background: radial-gradient(circle at top, #020617, #020617 70%);", "background: var(--gradient-modal);"],
  ["background: radial-gradient(circle at top left, #1e40af, #020617 55%, #000);", "background: var(--gradient-hero);"],
  ["background: linear-gradient(145deg, #1d4ed8, #020617);", "background: var(--gradient-avatar);"],
  ["background: radial-gradient(circle at top, #020617, #020617 40%, #020617);", "background: var(--gradient-board);"],
  ["background: linear-gradient(145deg, #020617, #111827);", "background: var(--gradient-calendar);"],
  ["background: radial-gradient(circle at top, #020617, #020617 65%);", "background: var(--gradient-calendar);"],
  ["background: linear-gradient(135deg, #020617, #0b1f3a);", "background: var(--gradient-card-soft);"],
  ["background: linear-gradient(135deg, #020617, #0f2948);", "background: var(--gradient-card-soft);"],
  ["background: rgba(15, 23, 42, 0.85);", "background: var(--color-overlay-heavy);"],
  ["background: rgba(2, 6, 23, 0.55);", "background: var(--color-overlay);"],
  ["background: rgba(15, 23, 42, 0.8);", "background: var(--color-control-bg-strong);"],
  ["background: rgba(15, 23, 42, 0.65);", "background: var(--color-control-bg);"],
  ["background: rgba(15, 23, 42, 0.7);", "background: var(--color-chip-bg);"],
  ["background: rgba(15, 23, 42, 0.5);", "background: var(--color-item-bg);"],
  ["background: rgba(15, 23, 42, 0.4);", "background: var(--color-item-bg);"],
  ["background: rgba(15, 23, 42, 0.35);", "background: var(--color-item-bg);"],
  ["background: rgba(15, 23, 42, 0.3);", "background: var(--color-item-bg);"],
  ["color: #e5e7eb;", "color: var(--color-text-subtle);"],
  ["color: #f9fafb;", "color: var(--color-text);"],
  ["color: #93c5fd;", "color: var(--color-link);"],
  ["color: #93c5fd !important;", "color: var(--color-link) !important;"],
  ["color: #fecaca;", "color: var(--color-danger-strong);"],
  ["color: #fecaca !important;", "color: var(--color-unread-text) !important;"],
  ["color: #fca5a5;", "color: var(--color-danger);"],
  ["color: #86efac;", "color: var(--color-success);"],
  ["color: #bfdbfe;", "color: var(--color-info);"],
  ["color: #dbeafe;", "color: var(--color-fin-tab-active-text);"],
  ["border-bottom: 1px solid rgba(148, 163, 184, 0.2);", "border-bottom: 1px solid var(--color-border);"],
  ["border-bottom: 1px solid rgba(148, 163, 184, 0.16);", "border-bottom: 1px solid var(--color-border);"],
  ["border-bottom: 1px solid rgba(148, 163, 184, 0.3);", "border-bottom: 1px solid var(--color-table-line);"],
  ["border-bottom: 1px solid rgba(148, 163, 184, 0.25);", "border-bottom: 1px solid var(--color-border);"],
  ["border-top: 1px solid rgba(148, 163, 184, 0.25);", "border-top: 1px solid var(--color-border);"],
  ["border-top: 1px solid rgba(148, 163, 184, 0.16);", "border-top: 1px solid var(--color-border);"],
  ["border: 1px solid rgba(148, 163, 184, 0.12);", "border: 1px solid var(--color-border);"],
  ["border: 1px solid rgba(148, 163, 184, 0.2);", "border: 1px solid var(--color-border);"],
  ["border: 1px solid rgba(148, 163, 184, 0.22);", "border: 1px solid var(--color-border);"],
  ["border: 1px solid rgba(148, 163, 184, 0.25);", "border: 1px solid var(--color-border);"],
  ["border: 1px solid rgba(148, 163, 184, 0.3);", "border: 1px solid var(--color-border);"],
  ["border: 1px solid rgba(148, 163, 184, 0.35);", "border: 1px solid var(--color-border-strong);"],
  ["border: 1px solid rgba(148, 163, 184, 0.4);", "border: 1px solid var(--color-border-strong);"],
  ["border: 1px solid rgba(148, 163, 184, 0.5);", "border: 1px solid var(--color-border-strong);"],
  ["border-color: rgba(148, 163, 184, 0.4);", "border-color: var(--color-border-strong);"],
  ["border-color: rgba(148, 163, 184, 0.45);", "border-color: var(--color-border-strong);"],
  ["border-color: rgba(148, 163, 184, 0.55);", "border-color: var(--color-border-strong);"],
  ["background: rgba(127, 29, 29, 0.35);", "background: var(--color-unread-bg);"],
  ["background: rgba(127, 29, 29, 0.25);", "background: var(--color-unread-bg);"],
  ["color: #fee2e2;", "color: var(--color-unread-text);"],
  ["color: rgba(226, 232, 240, 0.75);", "color: var(--color-text-muted);"]
];

for (const [from, to] of pairs) {
  css = css.split(from).join(to);
}

fs.writeFileSync(file, css);
console.log("tokens applied, remaining #020617", css.split("#020617").length - 1);
