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
