# 🏎️ Sprint Racer

Top-down toy cars racing around a product owner's desk — between sticky notes, a pencil and coffee rings. Three laps = three sprints. Your rivals are **Scope Creep** and **Tech Debt**.

**Play:** open `index.html` in any modern browser. No install, no build step, no dependencies.

| Action | Controls |
|---|---|
| Steer | ← → or A D |
| Gas / brake | ↑ ↓ or W S |
| Drift (handbrake) | Space |
| Restart | R |
| Mute | M |
| Mobile | on-screen buttons |

### Features
- Arcade drift physics with lateral grip, off-track slowdown and persistent skid marks.
- A Catmull-Rom spline track, checkpoints and lap timing; countdown goes *Planning → Refinement → Daily → GO!*
- Two AI rivals with a little rubber-banding, simple car-to-car collisions and a race position.
- Your best lap is saved locally and replayed as a **ghost car**.
- Engine sound synthesised with the Web Audio API, minimap, "Sprint review" results screen.

### Files
```
index.html   page shell + touch controls
style.css    layout
game.js      the whole game (commented)
```

Made by [Filip Stolarski](https://github.com/fisieek).

---

**PL:** Wyścigi samochodzików na biurku Product Ownera. 3 okrążenia = 3 sprinty, rywale: Scope Creep i Tech Debt. Otwórz `index.html` — sterowanie strzałkami/WASD, spacja to drift, R restart. Najlepsze okrążenie zapisuje się jako „duch”.

License: MIT
