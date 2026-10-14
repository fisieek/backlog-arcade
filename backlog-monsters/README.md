# 👾 Backlog Monsters

A pixel-art creature collector set in **Backlog Valley**. Walk into the tall grass, meet a wild backlog monster and throw a sticky note at exactly the right moment to catch it. Catch all eight to groom the backlog.

**Play:** open `index.html` in any modern browser. No install, no build step, no dependencies.

| Action | Controls |
|---|---|
| Walk | Arrow keys / WASD (D-pad on mobile) |
| Talk / confirm / throw | Space, Enter or Z (A on mobile) |
| Backlogdex | X (DEX on mobile) |

### The monsters
| | Rarity | Where |
|---|---|---|
| MVP, Bugzilla, Scope Creep | common | the meadow |
| Hotfix, Velocity | uncommon | east fields |
| Tech Debt | uncommon | south fields |
| Stakeholder | rare | south fields |
| Retro | rare | anywhere, once in a while |

### Under the hood
- 240 × 160 internal resolution with 16 px tiles, scaled up crisply (`image-rendering: pixelated`).
- Every sprite and tile is defined in code as tiny pixel maps — no image files.
- A hand-made 5 × 7 bitmap font, a timing-bar catch mechanic and chiptune blips via the Web Audio API.
- Your Backlogdex is saved in `localStorage`.

All monsters are original designs — no relation to any existing franchise.

Made by [Filip Stolarski](https://github.com/fisieek).

---

**PL:** Pikselowa gra w łapanie stworków z backlogu. Chodź po wysokiej trawie, a gdy trafisz na potwora — rzuć karteczką samoprzylepną w odpowiednim momencie. Złap wszystkie 8 (MVP, Bugzilla, Scope Creep, Hotfix, Velocity, Tech Debt, Stakeholder, Retro). Sterowanie: strzałki, spacja, X = Backlogdex.

License: MIT
