# 🕹️ Backlog Arcade

Three tiny browser games about life in product teams — made by a Product Owner who likes to ship things.

Each game is plain HTML, CSS and JavaScript in a single `<canvas>`: **no install, no build step, no dependencies.** Open a game's `index.html` in any modern browser and play.

| | Game | What it is | Folder |
|---|---|---|---|
| 🎾 | **Padel vs Filip** | Doodle-style padel. Beat Filip to 7 points — the glass walls are in play. | [`padel/`](padel) |
| 🏎️ | **Sprint Racer** | Top-down toy cars racing around a PO's desk. Three laps = three sprints, rivals: Scope Creep and Tech Debt. | [`sprint-racer/`](sprint-racer) |
| 👾 | **Backlog Monsters** | Pixel-art creature collector. Catch all eight backlog monsters with sticky notes. | [`backlog-monsters/`](backlog-monsters) |

## Play locally

```bash
git clone https://github.com/fisieek/backlog-arcade.git
cd backlog-arcade
open padel/index.html        # macOS · on Windows: start padel\index.html
```

Every game works straight from the file system, so double-clicking `index.html` is enough. Controls are listed in each game's README and on screen.

## What's inside

```
backlog-arcade/
├── padel/              pseudo-3D court, padel rules, adaptive opponent
├── sprint-racer/       drift physics, spline track, AI rivals, ghost car
└── backlog-monsters/   tile world, pixel sprites drawn in code, catch timing bar
```

Each folder is self-contained (`index.html`, `style.css`, `game.js`, `README.md`, `LICENSE`), so you can copy one game out and use it on its own. Sounds are synthesised with the Web Audio API and all graphics are drawn in code — there are no image or audio files.

## License

[MIT](LICENSE) © 2026 [Filip Stolarski](https://github.com/fisieek) · [LinkedIn](https://www.linkedin.com/in/filipstolarski/)

---

**PL:** Trzy małe gry przeglądarkowe o pracy w zespole produktowym — padel, wyścigi samochodzików na biurku Product Ownera i łapanie potworów z backlogu. Czysty HTML/CSS/JS, bez instalacji: otwórz `index.html` wybranej gry w przeglądarce.
