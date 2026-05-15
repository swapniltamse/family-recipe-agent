/* ── State ── */
let selectedMember = null;
let currentRecipeText = '';
let conversationHistory = [];

/* ── Loading messages ── */
const LOADING_MESSAGES = [
  'Swayampakghar ughadte ahe... (Opening the kitchen...)',
  'Aai la vicharato ahe... (Asking Aai...)',
  'Masale shodhto ahe... (Finding the spices...)',
  'Goda masala ahe ka? (Do we have goda masala?)',
  'Ghee garam hote ahe... (Heating the ghee...)',
  'Tadka tayyar hoto ahe... (Tadka is getting ready...)',
  'Chul petti ahe... (The stove is lit...)',
  'Recipe aathavato ahe... (Remembering the recipe...)',
];
let loadingInterval = null;

function startLoading() {
  const el = document.getElementById('loading-msg');
  const loading = document.getElementById('loading');
  let i = Math.floor(Math.random() * LOADING_MESSAGES.length);
  el.textContent = LOADING_MESSAGES[i];
  loading.classList.remove('hidden');
  loadingInterval = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    el.textContent = LOADING_MESSAGES[i];
  }, 2200);
}

function stopLoading() {
  clearInterval(loadingInterval);
  loadingInterval = null;
  document.getElementById('loading').classList.add('hidden');
}

/* ── Session limit ── */
const SESSION_LIMIT = 25;

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

/* ── Dark mode ── */
function initTheme() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-toggle').textContent = 'Light';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-toggle').textContent = 'Dark';
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-toggle').textContent = 'Light';
    localStorage.setItem('theme', 'dark');
  }
}

/* ── Google Analytics ── */
function initAnalytics() {
  if (!CONFIG.gaId) return;
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.gaId}`;
  script.async = true;
  document.head.appendChild(script);
  gtag('js', new Date());
  gtag('config', CONFIG.gaId);
}

/* ── Share ── */
async function shareApp() {
  const btn = document.getElementById('share-btn');
  const url = 'https://familyrecipe.swapniltamse.com';
  const text = 'Describe a dish from memory. Get the recipe back. Built for the Mhaddolkar sisters recipes.';

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Family Recipe Agent', text, url });
    } catch (_) {}
  } else {
    await navigator.clipboard.writeText(url);
    const original = btn.textContent;
    btn.textContent = 'Link copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('family-name').textContent = FAMILY_DATA.familyName;
  document.title = FAMILY_DATA.familyName;
  renderMemberCards();
  bindNavigation();
  updateCreditsBadge();
  initTheme();
  initAnalytics();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('share-btn').addEventListener('click', shareApp);
});

/* ── Screen management ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
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
      <div class="card-tags">${(member.tags || []).map(t => `<span class="card-tag">${t}</span>`).join('')}</div>
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

Be concise. Total response must be under 400 words. No preamble, no repetition.

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

/* ── Friendly error messages ── */
function friendlyError(err) {
  const status = err.status;
  const msg = (err.message || '').toLowerCase();
  if (status === 429 || status === 402 || msg.includes('rate limit') || msg.includes('quota') || msg.includes('credit')) {
    return `__QUOTA__`;
  }
  return `Something went wrong. Please try again in a moment.`;
}

function showQuotaError(targetEl) {
  targetEl.innerHTML = `
    <div class="quota-error">
      <img src="bai.jpg" alt="Itne paise mein itna hi milega" class="quota-img">
      <p class="quota-text">This demo has reached its limit for today.</p>
      <p class="quota-sub">Come back tomorrow, or build your own version for your family.</p>
      <a href="https://github.com/swapniltamse/family-recipe-agent" class="quota-link" target="_blank">Clone on GitHub</a>
    </div>
  `;
}

/* ── Recipe fetch (non-streaming — avoids Vercel Edge 30s timeout) ── */
async function fetchRecipe(messages, targetEl) {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.model,
      max_tokens: 2048,
      system: buildSystemPrompt(selectedMember),
      messages
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error(err.error?.message || `API error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = data.content[0].text;
  targetEl.innerHTML = DOMPurify.sanitize(marked.parse(text));
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
      `You have used all ${SESSION_LIMIT} recipes for today. Come back tomorrow for more.\n\nWant unlimited? Build one for your own family:\ngithub.com/swapniltamse/family-recipe-agent`;
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
  showScreen('result');
  startLoading();

  const btn = document.getElementById('get-recipe-btn');
  btn.disabled = true;

  try {
    const recipeEl = document.getElementById('recipe-content');

    const text = await fetchRecipe(conversationHistory, recipeEl);
    stopLoading();
    currentRecipeText = text;
    conversationHistory.push({ role: 'assistant', content: text });

    incrementPromptCount();
    document.getElementById('result-actions').classList.remove('hidden');
    document.getElementById('followup-section').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    stopLoading();
    document.getElementById('recipe-content').textContent =
      friendlyError(err) === '__QUOTA__'
        ? showQuotaError(document.getElementById('recipe-content'))
        : document.getElementById('recipe-content').textContent = friendlyError(err);
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

  // Append response container with placeholder
  const responseEl = document.createElement('div');
  responseEl.className = 'followup-response';
  responseEl.style.color = 'var(--mid)';
  responseEl.style.fontStyle = 'italic';
  responseEl.textContent = 'Thinking...';
  recipeEl.appendChild(responseEl);

  // Scroll to new content
  responseEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const responseText = await fetchRecipe(conversationHistory, responseEl);
    responseEl.style.color = '';
    responseEl.style.fontStyle = '';
    conversationHistory.push({ role: 'assistant', content: responseText });
  } catch (err) {
    friendlyError(err) === '__QUOTA__'
      ? showQuotaError(responseEl)
      : responseEl.textContent = friendlyError(err);
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
