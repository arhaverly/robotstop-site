# robot-stop website

The public site for **RobotStop** — a voice stop-request module for robots.

**Live:** https://arhaverly.github.io/robotstop-site/

A static site. No build step, no dependencies, no framework — plain HTML, CSS
and vanilla JS, served by GitHub Pages straight from `main`.

```
index.html        the main page
developers.html   how to read the JSON a detector emits
legal.html        terms of use and the safety notice
404.html          self-contained, styles inlined
styles.css        design system and layout
main.js           sticky nav, one-shot fade-in (both optional)
globe.js          the language globe: canvas 2D, orthographic, no deps
globe-land.js     generated land geometry (Natural Earth 110m, public domain)
docs.js           copy buttons + TOC tracking (developers.html only)
media/            demo video and poster
```

## Run it locally

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly works too.

## Contact

robotstop.contact@gmail.com

---

RobotStop is a supplementary protective measure. It is **not** an emergency
stop device under ISO 13850 and is **not** certified as a safety component. It
does not replace guarding, emergency stops, interlocks, procedures, training
or a risk assessment.
