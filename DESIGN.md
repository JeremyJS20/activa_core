# Design System: Institutional Authority (The Institution)

> 🎨 **Master UI/UX & Frontend Architecture Specification**  
> 🏛️ **Project:** ActivaCore — Sistema de Gestión de Activos Fijos & Contabilización (UNAPEC)  
> 🏷️ **Design System Name:** Institutional Authority (`The Institution`)  
> 📌 **Reference System:** `veedoria-monorepo/docs/pages_concept`

---

## 🏛️ 1. Filosofía Central & Manifiesto Estético

El sistema de diseño **"Institutional Authority" (The Institution)** está concebido para aplicaciones de misión crítica donde la sobriedad, la precisión de datos, la autoridad institucional y la confianza pública son imperativos. Elimina por completo el aspecto de "plantilla genérica" mediante:

1. **Soporte Nativo Dual-Mode (Light & Dark)**: Cada superficie, token, texto, borde y micro-interacción está diseñado con contraste matemático para ambos temas.
2. **La Regla Estructural "No-Line Layout"**: Las secciones de la interfaz se separan exclusivamente mediante **transiciones tonales de fondo** (`#F9F9FF` vs `#F2F3FF` vs `#FFFFFF`) y sombras de elevación difusas. Se prohíben las líneas divisorias negras o grises oscuras. Los bordes se restringen a un **Ghost Border** ultrafino con 8% a 10% de opacidad.
3. **Ritmo Espacial de 8px**: Toda la cuadrícula y márgenes respetan la escala armónica:
   - `4px` (xs) · `8px` (sm) · `12px` (md-sm) · `16px` (md) · `24px` (lg) · `32px` (xl) · `48px` (2xl) · `64px` (3xl).
4. **Densidad de Información Ejecutiva**: Balance exacto entre espacio en blanco respirable y alta densidad para tablas financieras y auditoría.

---

## 🎨 2. Mapeo de Tokens Cromáticos

### Modo Claro (Light Mode — Default)
| Token | Valor Hex / RGBA | Uso en la Interfaz |
|---|---|---|
| **Canvas Base** | `#F9F9FF` | Fondo general de la ventana del navegador (luz con sutil tinte azul frío). |
| **Surface Card** | `#FFFFFF` | Paneles principales, tarjetas de métricas, modales y formularios. |
| **Surface Inset** | `#F2F3FF` o `rgba(27, 42, 74, 0.04)` | Fondos de tablas, paneles embebidos, filtros y áreas secundarias. |
| **Text Primary** | `#1B2A4A` | **The Institution Navy**: títulos, cifras principales y texto de alto contraste. |
| **Text Secondary** | `#505F76` / `#434654` | Slate Grey: subtítulos, etiquetas secundarias, metadatos y breadcrumbs. |
| **Accent Primary (Gradient)** | `linear-gradient(135deg, #003D9B 0%, #0052CC 100%)` | Botones de acción primaria (CTA), estados activos y enlaces clave. Texto blanco (`#FFFFFF`). |
| **Accent Secondary** | `#505F76` | Botones secundarios, iconos pasivos y selectores. |
| **Surface Border (Ghost Border)**| `rgba(27, 42, 74, 0.08)` o `#CBD5E1` | Bordes hairline de 1px con opacidad tenue para delimitar componentes esenciales. |
| **Elevation Shadow** | `0 1px 3px rgba(27, 42, 74, 0.06), 0 4px 12px rgba(27, 42, 74, 0.04)` | Sombras suaves de profundidad sin bordes duros. |

### Modo Oscuro (Dark Mode)
| Token | Valor Hex / RGBA | Uso en la Interfaz |
|---|---|---|
| **Canvas Base** | `#111319` | Fondo general (carbón profundo de alta gama, no negro puro estéril). |
| **Surface Card** | `#1E1F25` | Tarjetas, paneles elevados y ventanas de diálogo. |
| **Surface Inset / Low** | `#1A1B21` / `#282A30` | Áreas de filtros, encabezados de tablas y fondos secundarios. |
| **Text Primary** | `#E2E2EA` | Blanco suave de lectura confortable. |
| **Text Secondary** | `#C4C6D4` | Plata mate para textos complementarios. |
| **Accent Primary (Gradient)** | `linear-gradient(135deg, #B2C5FF 0%, #003D9B 100%)` | Botón primario con texto navy oscuro (`#0A1628`). |
| **Accent Secondary** | `#505F76` | Iconografía pasiva y botones fantasma. |
| **Surface Border (Ghost Border)**| `rgba(255, 255, 255, 0.05)` o `#434654` | Delimitadores sutiles de componentes. |
| **Glowing Halo** | `0 0 20px rgba(77, 143, 214, 0.15)` | Resplandor sutil en elementos con foco o seleccionados. |

### Semántica de Estados & Severidad (Status Badges)
| Estado / Nivel | Fondo / Contenedor | Texto | Borde | Uso en ActivaCore |
|---|---|---|---|---|
| 🟢 **Vigente / Operativo** | `#DCFCE7` (Light) / `rgba(16, 185, 129, 0.15)` (Dark) | `#166534` (Light) / `#34D399` (Dark) | `#BBF7D0` / `rgba(16, 185, 129, 0.3)` | Activos en estado `ACTIVO`, depreciaciones calculadas, empleados activos. |
| 🟡 **En Mantenimiento** | `#FEF3C7` (Light) / `rgba(245, 158, 11, 0.15)` (Dark) | `#92400E` (Light) / `#FBBF24` (Dark) | `#FDE68A` / `rgba(245, 158, 11, 0.3)` | Bienes en reparación, alertas preventivas, traslados en trámite. |
| 🔴 **Crítico / Baja** | `#FFDAD6` (Light) / `rgba(248, 113, 113, 0.15)` (Dark) | `#93000A` (Light) / `#F87171` (Dark) | `#FFB4AB` / `rgba(248, 113, 113, 0.3)` | Activos `DADO_DE_BAJA`, desincorporaciones, bloqueos de cuenta. |
| ⚪ **Neutro / Archivo** | `#F1F5F9` (Light) / `rgba(148, 163, 184, 0.1)` (Dark) | `#475569` (Light) / `#94A3B8` (Dark) | `#E2E8F0` / `rgba(148, 163, 184, 0.2)` | Activos vendidos o donados, registros históricos. |

---

## 🔤 3. Jerarquía y Tríada Tipográfica

El sistema utiliza tres fuentes con propósitos estrictamente definidos:

### 1. `Manrope` — Display & Encabezados
- **Uso**: Títulos principales (`h1`, `h2`), nombre del producto y cifras de impacto en tarjetas KPI.
- **Pesos**: `600` (Semi-bold), `700` (Bold), `800` (Extra-bold).
- **Parámetros**:
  - `Headline-LG (h1)`: 26px bold, interlineado 32px, tracking `-0.02em`.
  - `Headline-MD (h2)`: 20px bold, interlineado 26px.
  - `Headline-SM (h3)`: 18px bold, interlineado 24px.

### 2. `Inter` — Interfaz, Navegación y Formularios
- **Uso**: Cuerpo de texto, etiquetas de formularios, menús de navegación, botones y notificaciones.
- **Pesos**: `400` (Regular), `500` (Medium), `600` (Semi-bold).
- **Parámetros**:
  - `Subheadline`: 15px regular, interlineado 22px.
  - `Body-MD / Label-MD`: 13px medium, interlineado 18px.
  - `Micro-Label / Overline`: 11px uppercase, peso 600, tracking expandido `0.08em` (ej. nombres de columna en tablas y metadatos).

### 3. `JetBrains Mono` — Datos Financieros, Cédulas y Códigos
- **Uso**: Exclusivo para valores numéricos y técnicos donde se requiere ancho de glifo fijo para perfecta alineación vertical:
  - Códigos correlativos: `ACT-2026-0001`, `DEP-001`, `EMP-001`.
  - Cédulas de Identidad JCE: `001-XXXXXXX-X`.
  - Cuentas contables: `1-01-04-0002`.
  - Números de serie de fabricante: `DL-99887766`.
  - Cifras monetarias en pesos: `RD$ 85,000.00` (alineadas a la derecha con `font-variant-numeric: tabular-nums`).
  - Marcas de tiempo de auditoría: `2026-10-12 20:34:10`.

---

## 📐 4. Geometría y Sistema de Radios (Shapes)

| Componente | Radio de Borde | Altura / Dimensión |
|---|---|---|
| **Botones Primarios (CTA) e Inputs** | `12px` (`rounded-xl`) | Altura 48px a 56px. Inputs con relleno horizontal de 16px. |
| **Botones Secundarios, Dropdowns, Enlaces Nav** | `8px` (`rounded-lg`) | Altura 40px a 44px. |
| **Paneles Inset, Tarjetas de Métricas, Tablas** | `16px` (`rounded-2xl`) | Contenedores modulares principales. |
| **Ventanas Modales y Paneles Héroe** | `20px` o `24px` (`rounded-3xl`) | Modales con sombra `shadow-2xl` y desenfoque. |
| **Badges / Tags / Status Pills** | `20px` (Pill completa) o `4px` | Altura 24px, relleno horizontal 10px, fuente 11px semi-bold. |
| **Avatares de Usuario** | Circular (`50%` / `rounded-full`) | 36px x 36px en barra, 48px en perfil. |

---

## 🖥️ 5. Arquitectura del Shell de la Consola (Console Layout)

El layout de la consola implementa una estructura de dos columnas de altura completa (`min-h-screen`, `100vh`):

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [Brand Header: 64px]           │ [Top Header: 64px (Breadcrumbs + Sim + User)] │
├────────────────────────────────┼──────────────────────────────────────────────┤
│                                │                                              │
│ Left Sidebar (240px -> 64px)   │ Main Workspace Viewport (Scrollable)         │
│                                │                                              │
│ - Nav Items (48px height)      │ - Metrics Row (Cards 1x4 Grid)               │
│   (Indicator 4px + Hover +2px) │ - Toolbar & Multicriteria Filters            │
│ - Role-Gated Menu Sections     │ - Data-Dense Table (Tabs, Pills, Actions)    │
│                                │                                              │
├────────────────────────────────┤                                              │
│ - User Profile Card (Avatar)   │                                              │
│ - Preferences & Theme Toggler  │                                              │
│ - Logout Button (Ghost Red)    │                                              │
└────────────────────────────────┴──────────────────────────────────────────────┘
```

### 5.1 Left Sidebar Especificaciones
1. **Comportamiento Colapsable Fluido**:
   - Ancho expandido: `240px`.
   - Ancho colapsado: `64px`.
   - Transición CSS: `transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1)`.
   - Posición: `fixed` a la izquierda, altura `100vh`, fondo `Surface Inset`.
2. **Botón Circular Flotante de Colapso**:
   - Ubicado exactamente sobre el borde derecho del sidebar: `right: -12px`, `top: 20px`, `z-index: 20`.
   - Diámetro `24px`, radio `12px`, fondo blanco, borde de 1px `#CBD5E1`, sombra de elevación.
   - Ícono `ChevronLeft` (al expandir) / `ChevronRight` (al colapsar).
3. **Ítems de Navegación**:
   - Altura: `48px`, radio: `8px`, tipografía: `Inter Label-MD 13px weight 500`.
   - **Estado Inactivo**: Texto e icono (20x20px) en Slate Grey sobre fondo transparente.
   - **Estado Hover**: Fondo `rgba(27, 42, 74, 0.04)`, texto `Text Primary`, desplazamiento interactivo de `transform: translateX(2px)`.
   - **Estado Activo**: Fondo suave `rgba(0, 61, 155, 0.06)`, texto `Institutional Blue (#003D9B)` con peso 600. **Barra indicadora vertical de 4px** (altura 24px, radio 2px) en el borde absoluto izquierdo.
   - **Estado Colapsado**: Oculta los textos y badges; muestra únicamente el icono centrado con la barra indicadora vertical activa visible.
4. **Sección Inferior (User Profile & Session)**:
   - Tarjeta de usuario con Avatar circular (36px), nombre en Inter 13px bold y rol pill.
   - Menú flotante de 3 puntos: selector de idioma, ajustes y selector de modo claro/oscuro.
   - Botón de cierre de sesión con icono `LogOut` que se colorea en rojo (`#EF4444`) en hover.

### 5.2 Top Header Minimalista
- Altura `64px`, borde inferior Ghost Border (10% opacidad).
- Izquierda: Breadcrumbs jerárquicos (ej: `ActivaCore / Inventario / Detalle ACT-2026-0001`).
- Centro: Atajo de búsqueda global visible (`Ctrl + K`).
- Derecha: **Simulador de Roles (Admin Role Simulator)**:
  - Selector desplegable exclusivo para usuarios `ADMIN` con opciones: `[ADMINISTRADOR]`, `[OPERADOR]`, `[AUDITOR]`.
  - Permite conmutar la experiencia visual de permisos y botones en tiempo real sin cerrar sesión.

---

## 📊 6. Grillas de Datos & Métricas (Data Density)

### 6.1 Fila de Métricas (Stats Cards 1x4 Grid)
- Cuatro tarjetas alineadas en cuadrícula de `grid-cols-1 md:grid-cols-4` con gap de `16px`.
- Cada tarjeta: radio de `16px`, relleno de `20px`, fondo `Surface Card`, sombra suave.
- Estructura interna:
  - Arriba: Etiqueta en Inter 11px uppercase tracking expandido con icono descriptivo en contenedor tonal.
  - Centro: Cifra numérica en **Manrope 24px Extra-bold** (ej: `1,280` o `RD$ 45.8M`).
  - Abajo: Línea de contexto o badge de variación (ej. `+12 incorporados este mes`).

### 6.2 Data Table de Alta Gama
- **Toolbar Superior**:
  - Input de búsqueda con icono de lupa (altura 40px, radio 12px, foco con anillo azul suave de 2px).
  - Filtros en línea mediante selectores limpios (Departamento, Tipo de Activo, Estado Operativo).
  - Botón "Exportar" con dropdown (Excel `.xlsx` / CSV UTF-8).
- **Cuerpo de la Tabla**:
  - Encabezados: Texto secundario en Inter 11px uppercase, tracking `0.08em`, fondo `Surface Inset`.
  - Filas: Altura uniforme de `52px`, transición en hover a `Surface Inset`.
  - Códigos en `JetBrains Mono` 12px con fondo suave.
  - Importes en `JetBrains Mono` alineados a la derecha con símbolo de moneda visible.
  - Status Pills compactas con dot indicador de color.
  - Columna de acciones fija a la derecha con menú desplegable (`...`): *Ver Ficha*, *Reasignar Custodio*, *Imprimir Marbete*, *Dar de Baja*.

---

## 🗂️ 7. Ficha Técnica & Drawer Forense (Asset Passport)

Para visualizar el detalle profundo de un activo sin perder el contexto de la lista, se utiliza un **Slide-Out Drawer Lateral**:
- Se despliega desde el borde derecho ocupando el **40% del ancho de pantalla** con fondo con desenfoque (`backdrop-blur-sm`).
- **Encabezado**: Código institucional en JetBrains Mono bold 18px, descripción y botón de cierre en cruz.
- **Pestaña 1: Información General**: Marca, modelo, serial, departamento, custodio actual con cédula validada, ubicación física.
- **Pestaña 2: Información Financiera DGII**: Cuenta contable de compra, cuenta de depreciación, categoría fiscal (5%, 25%, 15%), costo histórico, depreciación acumulada y valor en libros actual.
- **Pestaña 3: Línea de Tiempo de Custodia (Timeline)**:
  - Renderizado vertical de cada movimiento histórico.
  - Cada hito muestra: fecha/hora, custodio anterior $ightarrow$ nuevo custodio, justificación oficial, usuario auditor responsable y botón directo: `Descargar Acta PDF`.

---

## 🔐 8. Pantalla de Autenticación & Recuperación de Contraseña

### 8.1 Split-Screen Login
- **Mitad Izquierda (60% ancho en escritorio)**:
  - Panel visual en Azul Marino Profundo (`#0F172A`) con sutil cuadrícula vectorial institucional.
  - Logotipo oficial de UNAPEC en blanco y escudo vectorial.
  - Declaración de misión: *"Sistema Institucional de Gestión y Trazabilidad de Activos Fijos"*.
- **Mitad Derecha (40% ancho)**:
  - Tarjeta de formulario centrada (ancho máximo 420px).
  - Título en Manrope 24px bold *"Acceder al Sistema"*.
  - Inputs de usuario/correo y contraseña con iconos SVG a la izquierda y botón de alternar visibilidad de contraseña (ojo).
  - Fila de utilidad: Checkbox "Recordarme" y enlace *"¿Olvidaste tu contraseña?"* en color `#003D9B`.
  - Botón principal de ancho completo con gradiente a 135° (`linear-gradient(135deg, #003D9B, #0052CC)`), altura 56px, radio 12px y texto *"INICIAR SESIÓN"*.

### 8.2 Flujo de Recuperación en 3 Pasos
- **Paso 1 (/recuperar-contrasena)**: Tarjeta de 450px para ingresar el correo con enlace *"Volver al inicio de sesión"*.
- **Paso 2 (Feedback de Envío)**: Pantalla de confirmación con escudo verde (`#10B981`), aviso de validez de 15 minutos del token y botón *"Volver al Login"*.
- **Paso 3 (/restablecer-contrasena)**: Formulario de nueva contraseña con medidor de complejidad visual horizontal (Weak: Rojo, Medium: Amarillo, Strong: Verde) y validación de requisitos en tiempo real.

---

## 🏷️ 9. Especificaciones de Impresión de Marbetes (50mm x 25mm)

Para la rotulación física de bienes, la interfaz provee una vista de impresión que emite reglas CSS puras:
```css
@media print {
  @page {
    size: 50mm 25mm;
    margin: 0;
  }
  body {
    background: white;
    color: black;
  }
  .marbete-container {
    width: 50mm;
    height: 25mm;
    padding: 2mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
  }
}
```
- Incluye: Logotipo UNAPEC reducido, código institucional visible `ACT-YYYY-NNNN`, descripción breve, número de serie y departamento.

---

## ⚙️ 10. Código de Configuración para Tailwind CSS & shadcn/ui

Este bloque define la configuración exacta para `app/tailwind.config.ts` y `app/app/globals.css`:

```typescript
// app/tailwind.config.ts
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
        institution: {
          canvas: {
            light: "#F9F9FF",
            dark: "#111319",
          },
          card: {
            light: "#FFFFFF",
            dark: "#1E1F25",
          },
          inset: {
            light: "#F2F3FF",
            dark: "#1A1B21",
          },
          navy: "#1B2A4A",
          blue: {
            start: "#003D9B",
            end: "#0052CC",
            pastel: "#B2C5FF",
          },
          slate: {
            primary: "#505F76",
            muted: "#434654",
            silver: "#C4C6D4",
          },
          unapec: {
            blue: "#002B49",
            red: "#990000",
          }
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-manrope)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        input: "12px",
        card: "16px",
        modal: "20px",
        pill: "20px",
      },
      boxShadow: {
        ghost: "0 1px 3px rgba(27, 42, 74, 0.06), 0 4px 12px rgba(27, 42, 74, 0.04)",
        halo: "0 0 20px rgba(77, 143, 214, 0.25)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

---

© 2026 **ActivaCore** · Especificación Maestra de Diseño · Basado en el Sistema *Institutional Authority*.
