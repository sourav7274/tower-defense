---
name: Arcane Bastion
description: A readable elemental defense game set around a living magical citadel.
colors:
  night-ink: "#11182b"
  deep-forest: "#182b2a"
  parchment: "#f3e7bd"
  rune-gold: "#f5c451"
  ember: "#f06d45"
  frost: "#78d8e8"
  moss: "#86bc6e"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "system-ui, sans-serif"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "14px"
spacing:
  sm: "8px"
  md: "16px"
---

# Design System: Arcane Bastion

## Overview

**Creative North Star: "The Citadel War Table"**

Arcane Bastion treats the game field as a luminous relief map set into a dark command table at dusk. Parchment labels, carved stone panels, elemental color, and a warm citadel glow give the world its identity; the battlefield, not dashboard chrome, is always the hero.

**Key Characteristics:**
- A dark forest field under low evening light, punctuated by gold ward-light and elemental spell colors.
- Calm, structured control surfaces framing high-energy combat rather than competing with it.
- Crisp rune geometry and intentional impact motion, never decorative visual noise.

## Colors

Night ink and deep forest establish the field; rune gold identifies player agency, while ember and frost communicate combat roles.

## Typography

Display type is reserved for the title and terminal states. System UI type carries all tactical labels and numeric state for fast scanning.

## Layout

The battlefield owns the viewport center. A compact status rail sits above it, tower choices form a left dock, and selection details form a right dock. On narrow screens the docks become a lower control tray.

## Elevation & Depth

Depth comes from inset stone surfaces, soft offset shadows, and map lighting. Panels are materially distinct from the field; they do not use glass effects.

## Shapes

Panels have gently cut corners and restrained 8–14px radii. Towers use circular rune foundations, while enemy silhouettes remain immediately distinguishable at a glance.

## Components

### Buttons
- Primary actions use rune gold with night-ink text and a short press response.
- Secondary actions use an inset dark-stone surface with high-contrast parchment text.
- Focus is a visible frost outline; disabled actions remain legible.

### Tactical Panels
- Panels use deep forest/ink surfaces, a single fine warm border, and an offset ambient shadow.
- Dense values are grouped by role rather than placed in equal metric cards.

## Do's and Don'ts

### Do:
- **Do** reserve bright elemental color for player decisions, attacks, and enemy identity.
- **Do** make every upgrade and placement state readable without relying on color alone.
- **Do** keep the map visually dominant at every desktop breakpoint.

### Don't:
- **Don't** turn the field into a generic neon grid or a dashboard of equal cards.
- **Don't** use blur or glow to obscure hit ranges, paths, health, or target selection.
- **Don't** use an external font, icon service, or raster asset as a runtime dependency.
