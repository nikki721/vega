import { supabase } from './supabaseClient.js';

// Renders the (very small) login screen into #authScreen. No signup, no
// social login — this is a single-account diary; the account is created
// manually in Supabase (see SUPABASE_SETUP.md).
export function renderLoginScreen(errorMessage = '') {
  const el = document.getElementById('authScreen');
  el.innerHTML = `
    <div class="auth-card">
      <span class="panel-corner tl"></span>
      <div class="auth-brand">
        <div class="title">Academic Diary</div>
        <div class="subtitle">log · learn · remember</div>
      </div>
      <form id="loginForm" novalidate>
        <div class="auth-field">
          <label for="loginEmail">Email</label>
          <input id="loginEmail" type="email" autocomplete="username" required>
        </div>
        <div class="auth-field">
          <label for="loginPassword">Password</label>
          <input id="loginPassword" type="password" autocomplete="current-password" required>
        </div>
        <button type="submit" class="auth-submit" id="loginSubmit">SIGN IN</button>
        ${errorMessage ? `<div class="auth-error">${escapeHtml(errorMessage)}</div>` : ''}
      </form>
    </div>
  `;

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = document.getElementById('loginSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'SIGNING IN…';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Supabase's own message is safe to show (e.g. "Invalid login
      // credentials") — no internal/technical detail is exposed here.
      renderLoginScreen(error.message);
      return;
    }
    // On success, the onAuthStateChange listener registered in main.js
    // takes over and loads the app — nothing else to do here.
  });
}

export function showAuthScreen(errorMessage = '') {
  document.getElementById('bootScreen').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  renderLoginScreen(errorMessage);
}

export function hideAuthScreen() {
  document.getElementById('authScreen').style.display = 'none';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
