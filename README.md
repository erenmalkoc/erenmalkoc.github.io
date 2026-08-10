# erenium.tech

Static site for [erenium.tech](https://erenium.tech) — a one-page intro plus a subpage per product.

No build step, no dependencies. Every file ships as-is; any static host or plain nginx will do.

## Layout

```
.
├── index.html         # landing: multilingual greeting, products, social links
├── styles.css         # Material Design 3 tokens + all page styles
├── main.js            # theme toggle, greeting cycler, copy buttons
├── assets/            # favicon, product icons and screenshots
└── dirtymac/
    └── index.html     # /dirtymac — product page
```

## Local preview

```bash
python3 -m http.server 4000
```

Then open <http://localhost:4000>.

## Adding a product page

Create `<product>/index.html`, reuse `../styles.css` and `../main.js`, and add a card to the
Products section on the landing page.
