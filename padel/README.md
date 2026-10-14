# 🎾 Padel vs Filip

A tiny doodle-style padel game in a single `<canvas>`. Beat Filip to 7 points — he gets smug when he scores and sweaty when he's losing. The glass walls are in play, just like in real padel.

**Play:** open `index.html` in any modern browser. No install, no build step, no dependencies.

| Action | Controls |
|---|---|
| Move | Mouse / touch, or arrow keys / WASD |
| Serve | Click / tap, or Space |
| Rematch | Click or Space after the match |

### How it works
- A hand-rolled pseudo-3D projection (no WebGL) turns a 10 × 20 m court into the trapezoid you see.
- Real-ish padel rules: one bounce, then the glass may be used; hitting the glass before the bounce is out.
- The opponent predicts where the ball will be, moves with a speed limit and gets better every time you score.
- Lines "boil" slightly every 120 ms for a hand-drawn look; sounds are synthesised with the Web Audio API.

### Files
```
index.html   page shell + credits pill
style.css    layout
game.js      the whole game (~500 lines, commented)
```

Made by [Filip Stolarski](https://github.com/fisieek) — a Product Owner who likes to ship things.

---

**PL:** Mini gra w padla w stylu rysunkowym. Otwórz `index.html` w przeglądarce — bez instalacji. Ruch: mysz/strzałki, serw: klik/spacja. Wygrywa ten, kto pierwszy zdobędzie 7 punktów (z przewagą 2).

License: MIT
