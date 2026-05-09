/* ── State ── */
let selectedMember = null;
let currentRecipeText = '';

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('family-name').textContent = FAMILY_DATA.familyName;
  document.title = FAMILY_DATA.familyName;
  renderMemberCards();
  bindNavigation();
});

/* ── Screen management ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

/* ── Kitchen Picker ── */
function renderMemberCards() {
  const grid = document.getElementById('member-cards');
  grid.innerHTML = '';
  FAMILY_DATA.members.forEach(member => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
      <div class="card-name">${member.name}</div>
      ${member.location ? `<div class="card-location">${member.location}</div>` : ''}
      <div class="card-dish">${member.signature_dish || member.specialties[0]}</div>
    `;
    card.addEventListener('click', () => selectMember(member));
    grid.appendChild(card);
  });
}

function selectMember(member) {
  selectedMember = member;
  document.getElementById('member-heading').textContent = member.name + "'s Kitchen";
  document.getElementById('memory-input').value = '';
  document.getElementById('people-count').value = '';
  document.getElementById('occasion').value = '';
  showScreen('input');
}

/* ── Navigation ── */
function bindNavigation() {
  document.getElementById('back-to-picker').addEventListener('click', () => showScreen('picker'));
  document.getElementById('back-to-input').addEventListener('click', () => showScreen('input'));
  document.getElementById('try-another-btn').addEventListener('click', () => showScreen('picker'));
}

/* ── System prompt builder ── */
function buildSystemPrompt(member) {
  return `You are a recipe assistant trained on ${member.name}'s kitchen.
Cuisine: ${FAMILY_DATA.cuisines.join(', ')}
Specialties: ${member.specialties.join(', ')}
Cooking style: ${member.style}

The user will describe a dish from memory. Reconstruct the full recipe from that description.
Provide: ingredients with quantities, step-by-step method, what to pair it with, one tip specific to ${member.name}'s style.
If the description is vague, state your assumptions clearly at the top.
End with: "Does this sound right? Tell me what to adjust."`;
}

/* ── Get Recipe ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('get-recipe-btn').addEventListener('click', getRecipe);
  document.getElementById('memory-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.metaKey) getRecipe();
  });
});

async function getRecipe() {
  const memory = document.getElementById('memory-input').value.trim();
  if (!memory) {
    document.getElementById('memory-input').focus();
    return;
  }

  const people = document.getElementById('people-count').value.trim();
  const occasion = document.getElementById('occasion').value.trim();

  let userMessage = memory;
  if (people) userMessage += `\n\nFor ${people} people.`;
  if (occasion) userMessage += `\nOccasion: ${occasion}.`;

  // Switch to result screen
  document.getElementById('result-member-name').textContent = selectedMember.name + "'s Kitchen";
  currentRecipeText = '';
  document.getElementById('recipe-content').textContent = '';
  document.getElementById('result-actions').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  showScreen('result');

  // Disable button during fetch
  const btn = document.getElementById('get-recipe-btn');
  btn.disabled = true;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: 1500,
        stream: true,
        system: buildSystemPrompt(selectedMember),
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const recipeEl = document.getElementById('recipe-content');
    document.getElementById('loading').classList.add('hidden');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            currentRecipeText += evt.delta.text;
            recipeEl.textContent = currentRecipeText;
          }
        } catch (_) {}
      }
    }

    document.getElementById('result-actions').classList.remove('hidden');

  } catch (err) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('recipe-content').textContent =
      `Something went wrong: ${err.message}\n\nCheck your API key in web/config.js`;
  } finally {
    btn.disabled = false;
  }
}

/* ── Export ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('save-pdf-btn').addEventListener('click', saveAsPDF);
  document.getElementById('save-txt-btn').addEventListener('click', saveAsTXT);
});

function saveAsPDF() {
  window.print();
}

function saveAsTXT() {
  if (!currentRecipeText) return;
  const memberSlug = selectedMember.skill_id || selectedMember.name.toLowerCase().replace(/\s+/g, '-');
  const filename = `${memberSlug}-recipe.txt`;
  const blob = new Blob([currentRecipeText], { type: 'text/plain; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
