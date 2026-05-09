/* ── State ── */
let selectedMember = null;
let currentRecipeText = '';
let conversationHistory = [];

/* ── Session limit ── */
const SESSION_LIMIT = 10;

function getPromptCount() {
  return parseInt(sessionStorage.getItem('recipeCount') || '0', 10);
}

function incrementPromptCount() {
  sessionStorage.setItem('recipeCount', String(getPromptCount() + 1));
  updateCreditsBadge();
}

function updateCreditsBadge() {
  const remaining = SESSION_LIMIT - getPromptCount();
  const badge = document.getElementById('credits-badge');
  if (!badge) return;
  badge.textContent = remaining + ' recipe' + (remaining === 1 ? '' : 's') + ' left';
  badge.className = 'credits-badge';
  if (remaining <= 2) badge.classList.add('critical');
  else if (remaining <= 5) badge.classList.add('low');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('family-name').textContent = FAMILY_DATA.familyName;
  document.title = FAMILY_DATA.familyName;
  renderMemberCards();
  bindNavigation();
  updateCreditsBadge();
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
  conversationHistory = [];
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
If the description is vague, state your assumptions in one short line at the top.

Always use this exact format — no tables, no variations:

## [Dish Name]

**Serves:** X

## Ingredients
- ingredient — quantity
- ingredient — quantity

## Method
1. **Step:** instruction
2. **Step:** instruction

## Serve with
- accompaniment

## ${member.name}'s tip
*One specific tip from her style.*

---
Does this sound right? Tell me what to adjust.

For follow-up messages: help adjust the recipe — swap ingredients, change quantities, simplify steps. Keep responses concise and practical. Use the same format if rewriting the recipe.`;
}

/* ── Shared streaming function ── */
async function streamInto(messages, targetEl, onChunk) {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.model,
      max_tokens: 4096,
      stream: true,
      system: buildSystemPrompt(selectedMember),
      messages
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  // Stream as plain text — avoids broken mid-markdown renders
  targetEl.style.whiteSpace = 'pre-wrap';
  targetEl.textContent = '';

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
          text += evt.delta.text;
          targetEl.textContent = text;
        }
      } catch (_) {}
    }
  }

  // Render markdown once stream is complete
  targetEl.style.whiteSpace = '';
  targetEl.innerHTML = marked.parse(text);

  return text;
}

/* ── Get Recipe ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('get-recipe-btn').addEventListener('click', getRecipe);
  document.getElementById('memory-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.metaKey) getRecipe();
  });
  document.getElementById('followup-btn').addEventListener('click', sendFollowUp);
  document.getElementById('followup-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendFollowUp();
  });
});

async function getRecipe() {
  const memory = document.getElementById('memory-input').value.trim();
  if (!memory) {
    document.getElementById('memory-input').focus();
    return;
  }

  if (getPromptCount() >= SESSION_LIMIT) {
    document.getElementById('result-member-name').textContent = selectedMember.name + "'s Kitchen";
    document.getElementById('recipe-content').textContent =
      `This demo allows ${SESSION_LIMIT} recipes per session. To use it for your own family, clone the project and add your own Claude API key:\ngithub.com/swapniltamse/mhardolkar-family-recipe-agent`;
    document.getElementById('result-actions').classList.add('hidden');
    document.getElementById('followup-section').classList.add('hidden');
    document.getElementById('loading').classList.add('hidden');
    showScreen('result');
    return;
  }

  const people = document.getElementById('people-count').value.trim();
  const occasion = document.getElementById('occasion').value.trim();

  let userMessage = memory;
  if (people) userMessage += `\n\nFor ${people} people.`;
  if (occasion) userMessage += `\nOccasion: ${occasion}.`;

  conversationHistory = [{ role: 'user', content: userMessage }];

  document.getElementById('result-member-name').textContent = selectedMember.name + "'s Kitchen";
  currentRecipeText = '';
  document.getElementById('recipe-content').innerHTML = '';
  document.getElementById('result-actions').classList.add('hidden');
  document.getElementById('followup-section').classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  showScreen('result');

  const btn = document.getElementById('get-recipe-btn');
  btn.disabled = true;

  try {
    const recipeEl = document.getElementById('recipe-content');
    document.getElementById('loading').classList.add('hidden');

    const text = await streamInto(conversationHistory, recipeEl);
    currentRecipeText = text;
    conversationHistory.push({ role: 'assistant', content: text });

    incrementPromptCount();
    document.getElementById('result-actions').classList.remove('hidden');
    document.getElementById('followup-section').classList.remove('hidden');
    document.getElementById('followup-input').focus();

  } catch (err) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('recipe-content').textContent =
      `Something went wrong: ${err.message}\n\nCheck your API key in web/config.js`;
  } finally {
    btn.disabled = false;
  }
}

/* ── Follow-up chat ── */
async function sendFollowUp() {
  const input = document.getElementById('followup-input');
  const text = input.value.trim();
  if (!text || !selectedMember) return;

  const followupBtn = document.getElementById('followup-btn');
  followupBtn.disabled = true;
  input.value = '';

  conversationHistory.push({ role: 'user', content: text });

  const recipeEl = document.getElementById('recipe-content');

  // Append user question
  const questionEl = document.createElement('div');
  questionEl.className = 'followup-question';
  questionEl.textContent = text;
  recipeEl.appendChild(questionEl);

  // Append streaming response container
  const responseEl = document.createElement('div');
  responseEl.className = 'followup-response';
  recipeEl.appendChild(responseEl);

  // Scroll to new content
  responseEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const responseText = await streamInto(conversationHistory, responseEl);
    conversationHistory.push({ role: 'assistant', content: responseText });
  } catch (err) {
    responseEl.textContent = `Something went wrong: ${err.message}`;
  } finally {
    followupBtn.disabled = false;
    input.focus();
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
  const content = document.getElementById('recipe-content').innerText;
  if (!content) return;
  const memberSlug = selectedMember.skill_id || selectedMember.name.toLowerCase().replace(/\s+/g, '-');
  const filename = `${memberSlug}-recipe.txt`;
  const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
