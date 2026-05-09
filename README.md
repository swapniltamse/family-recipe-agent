# Family Recipe Agent

Preserve your family's recipes before they're forgotten.

Each family member gets her own AI agent trained on her kitchen context.
You describe a memory. The agent reconstructs the recipe.

Built with Claude Code. Inspired by moms who never measured anything.

---

## What you need

- Python 3.7+
- A Claude API key (get one at console.anthropic.com — pay per use, a recipe costs ~$0.001)
- A browser

## Setup (5 minutes)

**1. Clone the repo**
```bash
git clone https://github.com/YOUR_USERNAME/family-recipe-agent.git
cd family-recipe-agent
```

**2. Install PyYAML**
```bash
pip install pyyaml
```

**3. Fill in your family**

Copy `family-profile.example.yaml` to `family-profile.yaml` and edit it.
Add each family member — their name, specialties, cooking style.

**4. Generate everything**
```bash
python setup.py
```

This creates `CLAUDE.md`, skill files for each family member, and the web app config.

**5. Add your API key**

```bash
cp web/config.example.js web/config.js
# Edit web/config.js and replace sk-ant-YOUR-KEY-HERE with your real key
```

**6. Open the app**

Open `web/index.html` in any browser. No server needed.

---

## Using it with Claude Code

If you use Claude Code, the generated skills let you query recipes directly in your terminal:

```
/mom "rava thalipeeth, no spices, the way she makes it for breakfast"
```

---

## Adding more context

Drop exported chat conversations into the `conversations/` folder.
See `conversations/README.md` for supported formats.

---

## Privacy

Your family profile and API key stay on your machine. Recipe queries go to Anthropic's API.
See [Anthropic's privacy policy](https://www.anthropic.com/privacy) for details.
