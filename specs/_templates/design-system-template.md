# Design System Specification: [Theme Name / Visual Identity]

> 🎨 Master UI/UX Design System Specification · Living Visual Standard  
> 🔄 Last Updated: [YYYY-MM-DD] · Status: [Draft / Approved / In Production]  
> 👤 Design Authority: [Lead Designer / Frontend Architect]  
> 📂 Repository Location: `DESIGN.md` (root) or `docs/architecture/design-system.md`  
> ⚠️ **MANDATORY QUALITY GATE (Hard Gate 17 — Anti-Generic UI Mandate)**: Frontend applications MUST NOT look like unstyled generic Bootstrap templates or default flat-white component dumps. Every user-facing system must define a deliberate visual identity, dual-mode color tokens, the "No-Line" spatial layout rule, a typographic triad, and rich micro-interaction states.

---

## 1. Aesthetic Philosophy & Visual Identity

### 1.1 Design Persona & Theme Narrative
- **Theme Name**: [e.g. Institutional Authority, FinTech High-Density, Clean Minimalist Saas]
- **Design Persona**: [e.g. The Institution — Authoritative, deliberate, secure, and modern; designed for enterprise governance and institutional trust.]
- **Anti-Generic Directives**:
  - **No Plain White/Black Extremes**: Avoid blinding pure `#FFFFFF` backgrounds or harsh `#000000` borders. Use nuanced tinted canvases and subtle tonal shifts.
  - **No Cookie-Cutter Blue**: Avoid generic primary blues (`#0000FF` or default browser blue). Use deep corporate navies, slate-tinted indigos, or brand-specific refined gradients.
  - **Elevation Over Outlines**: Separate content using background tint contrast and diffuse shadows rather than dense black borders.

---

## 2. Semantic Dual-Mode Token System

| Token Name | Light Mode (Default) | Dark Mode | Role / Semantic Purpose |
| :--- | :--- | :--- | :--- |
| **`canvas-base`** | `#[hex]` (e.g. `#F9F9FF`) | `#[hex]` (e.g. `#111319`) | Global app background, viewport canvas |
| **`surface-card`** | `#[hex]` (e.g. `#FFFFFF`) | `#[hex]` (e.g. `#1E1F25`) | Form containers, modal dialogs, elevated cards |
| **`surface-inset`** | `#[hex]` (e.g. `#F2F3FF`) | `#[hex]` (e.g. `#1A1B21`) | Sidebar background, table header tint, filter trays |
| **`text-primary`** | `#[hex]` (e.g. `#1B2A4A`) | `#[hex]` (e.g. `#E2E2EA`) | Headings, main metric numbers, table primary text |
| **`text-secondary`** | `#[hex]` (e.g. `#505F76`) | `#[hex]` (e.g. `#C4C6D4`) | Subtitles, labels, breadcrumbs, muted metadata |
| **`accent-primary`** | Gradient `135° #[hex] ➔ #[hex]` | Gradient `#[hex] ➔ #[hex]` | Primary CTA buttons, active state indicators |
| **`ghost-border`** | `rgba([r],[g],[b], 0.08)` / `#CBD5E1` | `rgba(255,255,255, 0.05)` | Subtle structural demarcation (8-10% opacity) |

### 2.1 Status Badges & Semantic Feedback Pills

| State / Badge | Background (Light) | Text Color (Light) | Dark Mode Equivalent | Dot Indicator |
| :--- | :--- | :--- | :--- | :--- |
| **Active / Success** | `bg-emerald-50` (`#DCFCE7`) | `text-emerald-700` (`#166534`) | `bg-emerald-950/40 text-emerald-400` | Emerald pulse dot |
| **Warning / In-Review** | `bg-amber-50` (`#FEF3C7`) | `text-amber-800` (`#92400E`) | `bg-amber-950/40 text-amber-300` | Solid amber dot |
| **Danger / Terminated** | `bg-rose-50` (`#FFDAD6`) | `text-rose-800` (`#93000A`) | `bg-rose-950/40 text-rose-300` | Solid rose dot |
| **Neutral / Draft** | `bg-slate-100` (`#F1F5F9`) | `text-slate-700` (`#334155`) | `bg-slate-800 text-slate-300` | Slate dot |

---

## 3. Spatial Hierarchy & The "No-Line" Layout Rule

1. **Background Contrast Over Borders**:
   - Primary content areas, sidebars, and filter trays MUST NOT be separated by heavy `1px solid black` or dark gray border lines.
   - Spatial differentiation is achieved via background tonal shifts (`surface-inset` `#F2F3FF` adjacent to `canvas-base` `#F9F9FF` and elevated `surface-card` `#FFFFFF`).
2. **Ghost Borders**:
   - Thin borders with `8% - 10%` opacity (`rgba(27, 42, 74, 0.08)` in light mode, `rgba(255, 255, 255, 0.05)` in dark mode) are used strictly where required for accessibility and contrast ratios (WCAG AA).
3. **Elevation & Diffuse Shadows**:
   - Soft, multi-layered diffuse shadows: `shadow-sm shadow-slate-900/5` or `0 1px 3px rgba(0,0,0,0.05), 0 10px 15px -5px rgba(0,0,0,0.02)`.
   - Modals and floating popovers use `shadow-xl shadow-slate-900/10` with backdrop blur (`backdrop-blur-sm`).

---

## 4. Typographic Triad

A professional enterprise application MUST employ three distinct typographic roles:

```mermaid
graph LR
    Display["🔠 Display Font\n(Manrope / Plus Jakarta Sans)\nHeadings, H1/H2, Brand Titles"]
    Body["📝 Body & UI Font\n(Inter / Geist Sans)\nNavigation, Forms, Labels, Buttons"]
    Mono["🔢 Monospace Font\n(JetBrains Mono / Geist Mono)\nCodes, National IDs, Currency amounts"]
```

### 4.1 Typography Scale & Rules
- **Display Font (`font-display`)**:
  - Purpose: Page titles, marketing banners, high-impact modal headers.
  - Scale: H1 (28px - 32px, bold 700/800, tracking -0.02em), H2 (22px - 24px, bold 700, tracking -0.015em).
- **Body / UI Font (`font-sans`)**:
  - Purpose: Form labels, table cell descriptions, button text, tooltips.
  - Scale: Body Base (14px - 15px, regular 400), Label MD (13px, medium 500), Micro-Badge (11px, uppercase, tracking +0.08em).
- **Monospace Font (`font-mono`)**:
  - Purpose: Entity codes (`ACT-2026-0001`), tax IDs (`001-XXXXXXX-X`), serial numbers, financial balances (`RD$ 125,000.00`).
  - Alignment Rule: **All numeric, financial, and currency amounts in tables MUST be right-aligned (`text-right`) and rendered in monospace.**

---

## 5. Layout Shell Architecture (The Console Layout)

```mermaid
flowchart TD
    subgraph Shell ["Console Layout Shell (min-h-screen)"]
        Sidebar["📱 Left Sidebar\n(Dynamic 240px ➔ 64px)"]
        Header["🔝 Top Header Bar\n(64px height, breadcrumbs + user chip)"]
        Workspace["🖥️ Scrollable Workspace\n(100% remaining width, canvas-base)"]
    end
    Sidebar --> Workspace
    Header --> Workspace
```

### 5.1 Left Sidebar Specifications
- **Width Transitions**: Transitions smoothly from **240px (expanded)** to **64px (collapsed)** using CSS `transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1)`.
- **Collapse Toggle Button**: Circular icon button (24px x 24px, 12px radius, white background, shadow elevation) positioned absolutely on the right border edge of the sidebar (`right-[-12px] top-[20px] z-20`). Toggles between `chevron-left` and `chevron-right`.
- **Navigation Item States**:
  - *Inactive*: Text Secondary color, transparent background.
  - *Hover*: Micro-translation `translateX(+2px)` with subtle background tint `rgba(27, 42, 74, 0.04)`.
  - *Active*: Accent text color, weight 600, with a **4px vertical active indicator bar** (`h-6 w-1 rounded-r-full`) positioned on the absolute left edge.
  - *Collapsed State*: Label text and right badges are hidden (`hidden`); centered 20px icons and active indicator bar remain fully visible.
- **Bottom User Profile Card**:
  - Fixed at the bottom of the sidebar. Displays circular avatar (36px), user name, role badge, and popover preferences trigger.

### 5.2 Top Header Bar Specifications
- **Height**: Exactly `64px`, with subtle bottom ghost border (`border-b border-slate-200/80`).
- **Left**: Dynamic breadcrumbs hierarchy (`Inter 12px`, e.g. `Inicio / Activos / Ficha Técnica`).
- **Center**: Quick-search spotlight trigger (`Cmd + K` / `Ctrl + K`).
- **Right**: Role simulator dropdown (for previewing role experiences live) and notification bell with count badge.

---

## 6. Component Specifications

### 6.1 KPI Summary Cards
- Container: `surface-card` background, `ghost-border`, `shadow-sm shadow-slate-900/5`, `p-5 rounded-xl`.
- Layout: Icon container (40px x 40px rounded-lg with soft brand tint) top-right, label (Inter 13px text-secondary) top-left, big metric value (Display/Mono 24px bold) bottom-left, percentage change badge bottom-right.
- Hover Effect: Subtle border highlight transition `border-slate-300` on hover.

### 6.2 Data Tables
- Header: `surface-inset` background, uppercase 11px Inter labels with `tracking-wider`, `text-slate-500`.
- Rows: Alternating or clean rows with hover highlight `hover:bg-slate-50/80`.
- Cells: Vertical alignment center, standard padding `py-3.5 px-4`.
- Numeric / Financial Columns: Strictly right-aligned (`text-right font-mono text-sm`).
- Sticky Pagination Footer: Fixed at the bottom of the table viewport with total count, page size selector, and previous/next page buttons.

### 6.3 Action Buttons
- **Primary CTA**: Brand accent gradient (`bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-800 hover:to-indigo-700 text-white font-medium rounded-lg px-4 py-2 shadow-sm transition-all active:scale-[0.98]`).
- **Secondary / Ghost**: Ghost border `border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2`.
- **Destructive**: Rose tint `bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200`.

---

## 7. Tailwind CSS Configuration Blueprint (`tailwind.config.ts`)

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          base: "var(--canvas-base)",
        },
        surface: {
          card: "var(--surface-card)",
          inset: "var(--surface-inset)",
        },
        brand: {
          primary: "var(--brand-primary)",
          navy: "#002B49",
          crimson: "#990000",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

---

## 8. Verification & Compliance Checklist (Gate 17)

Before approving any UI task or front-end pull request, verify:
- [ ] No raw `#000000` or harsh 1px borders used as layout separators.
- [ ] Dual-mode support verified: all components render cleanly in both Light and Dark mode.
- [ ] Typographic triad applied: headings use Display font, UI uses Sans, monetary amounts and codes use Monospace.
- [ ] Financial and code amounts in tables are right-aligned.
- [ ] Status pills use soft tinted containers (`bg-*-50 text-*-700 border-*-200`), not saturated solid primaries.
- [ ] Sidebar collapses smoothly (240px ➔ 64px) with icon centering and left indicator bars.
- [ ] Interactive elements have active/hover feedback states (`active:scale-[0.98]`, hover micro-translations).
