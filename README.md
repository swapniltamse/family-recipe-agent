# Family Recipe Agent

Preserve your family's recipes before they're forgotten.

Each family member gets her own AI agent trained on her kitchen. You describe a dish from memory. The agent reconstructs the recipe.

Live demo: [familyrecipe.swapniltamse.com](https://familyrecipe.swapniltamse.com)

Built with Claude Code. Inspired by moms who never measured anything.

---

## How it works

The web app has no backend of its own. Recipe requests go from the browser to a lightweight server proxy (`/api/messages`), which adds your Anthropic API key and forwards to Claude. The key never touches the browser.

```
Browser → /api/messages (Vercel or server.py) → Anthropic API
```

---

## What you need

- Python 3.7+
- A Claude API key — get one at [console.anthropic.com](https://console.anthropic.com) (pay per use, a recipe costs ~$0.001)
- A browser

---

## Setup

**1. Clone the repo**
```bash
git clone https://github.com/swapniltamse/mhardolkar-family-recipe-agent.git
cd mhardolkar-family-recipe-agent
```

**2. Install PyYAML**
```bash
pip install pyyaml
```

**3. Fill in your family**

Copy `family-profile.example.yaml` to `family-profile.yaml` and edit it. Add each family member — their name, location, specialties, cooking style, and tags.

**4. Generate the web config**
```bash
python setup.py
```

This creates `web/family-data.js` with your family's data, plus `CLAUDE.md` and skill files if you use Claude Code.

**5. Add your API key**

The API key goes in your environment, not in any file that could be committed.

For local development:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
python server.py
```

Then open [http://localhost:8787](http://localhost:8787).

**6. Optional: override the model**

Copy `web/config.example.js` to `web/config.js` (gitignored). Edit it to change the model:

```js
const CONFIG = {
  model: 'claude-sonnet-4-6',  // richer recipes, higher cost
};
```

---

## Deploy to Vercel (recommended)

Vercel runs the `/api/messages` proxy automatically. No server setup needed.

1. Push your repo to GitHub
2. Import it at [vercel.com](https://vercel.com)
3. Add `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables
4. Deploy

Your family URL is live. Share it with family members — no installs, no accounts.

---

## Features

- **Kitchen picker** — each family member gets her own card with tags (cuisine, specialties)
- **Memory input** — describe a dish, optionally add serving size and occasion
- **Recipe output** — formatted in markdown with ingredients, method, serving suggestions, and a personal tip from that kitchen
- **Follow-up chat** — adjust the recipe inline: swap ingredients, change quantities, simplify steps
- **Save as PDF** — browser print dialog, formatted for paper
- **Save as TXT** — plain text download
- **Dark mode** — persists across sessions
- **Share button** — Web Share API with clipboard fallback

---

## Using it with Claude Code

If you use Claude Code, the generated skills let you query recipes directly in your terminal:

```
/mom "rava thalipeeth, no spices, the way she makes it for breakfast"
```

---

## Privacy

Your family profile stays on your machine. Recipe queries go to Anthropic's API with your key. See [Anthropic's privacy policy](https://www.anthropic.com/privacy).

The API key is stored as an environment variable — never in the browser, never in git.
