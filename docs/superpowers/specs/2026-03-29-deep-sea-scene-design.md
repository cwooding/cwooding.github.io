# Bioluminescent Deep Sea — Design Spec

**Date:** 2026-03-29
**Site:** cwooding.github.io

## Overview

A new scene for the scene system: an underwater abyss populated by bioluminescent organisms. Touch/mouse creates pressure waves that trigger chain reactions of light cascading through the ecosystem. Canvas 2D with additive blending, zero dependencies.

## File

- Create: `scenes/deep-sea.js`
- Modify: `main.js` — add import and register in SCENES array

## Scene Interface

Same as particles.js:

```js
export const name = 'deep-sea';
export function init(canvas, ctx, pointer) { ... }
export function destroy() { ... }
export function onKey(e) { ... }
```

## Visual Design

- **Background:** Deep ocean near-black (`#030810`)
- **Blending:** `globalCompositeOperation: 'lighter'` for all organism drawing — overlapping glows naturally brighten
- **Glow technique:** Each organism draws a large, low-opacity radial gradient circle (the ambient glow), then a smaller bright core shape on top

## Organism Types

### Jellyfish (random 8–12, chosen on each init)

- **Shape:** Bell drawn with bezier curves, trailing tentacles as wavy lines
- **Movement:** Slow vertical drift with rhythmic pulse cycle — bell contracts (pushes upward), relaxes (sinks). Slight horizontal wander
- **Glow color:** Soft magenta/pink (`#ff3090`)
- **Pulse:** Rhythmic contraction every ~3–4 seconds. Each pulse brightens the glow momentarily
- **Startle response:** Fast defensive contraction, bright flash. Flash emits a secondary mini-wave (~150px radius over ~400ms) that can startle nearby plankton

### Plankton (200 default, adjustable 100–400)

- **Shape:** Tiny dots (radius 1–2px)
- **Movement:** Loose flocking — each follows nearby neighbors with slight randomness. Gentle drift
- **Glow color:** Bioluminescent green (`#00ffa0`)
- **Normal state:** Dim glow
- **Startle response:** Flash bright green for ~500ms, scatter away from disturbance, then fade and resume flocking

### Lanternfish (random 15–20, chosen on each init)

- **Shape:** Oval body with a bright lure dot offset forward
- **Movement:** Cruise horizontally, occasionally change direction. Bounce off edges
- **Glow color:** Warm amber/gold (`#ffb040`)
- **Lure:** Blinks at random intervals (~every 2–5 seconds)
- **Startle response:** Dart away quickly from disturbance, lure flashes rapidly for ~1 second

## Chain Reaction Mechanic

1. **Touch/click** creates an invisible pressure wave — expanding circle, ~300px radius over ~800ms
2. **Plankton** hit by the wave flash and scatter
3. **Jellyfish** hit by the wave do a sharp defensive pulse with a bright flash. The flash emits a secondary mini-wave (~150px over ~400ms) that startles nearby plankton
4. **Lanternfish** hit by the wave dart away with rapid lure flashing

Chain example: touch → startles jellyfish → jellyfish flash triggers mini-wave → mini-wave startles nearby plankton → green flash spreads outward.

## Idle Behavior

Everything moves and pulses gently without interaction:
- Jellyfish pulse rhythmically on their own cycle
- Plankton drift in loose schools
- Lanternfish cruise and blink

The scene feels alive even when no one is touching it.

## Controls

- `+` key: increase plankton count by 25 (max 400)
- `-` key: decrease plankton count by 25 (min 100)
- Default plankton count: 200
- Jellyfish (8–12) and lanternfish (15–20) counts are fixed

## Performance

- Single canvas, additive blending only
- No `shadowBlur` — glow via radial gradients + additive compositing
- Depth illusion from size and speed differences only, no z-sorting
- Plankton are the main perf cost — capped at 400
