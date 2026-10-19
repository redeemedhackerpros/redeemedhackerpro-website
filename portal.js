import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.RHP_SUPABASE_CONFIG || {};
const key = config.publishableKey || '';
const configured = Boolean(config.url && key && !key.includes('PASTE_YOUR_'));
const supabase = configured ? createClient(config.url, key) : null;
const $ = (id) => document.getElementById(id);
let authMode = 'signin';
let currentUser = null;
let isStaff = false;
let pendingMfaFactorId = null;

const showMessage = (message, kind = '') => {
  const el = $('message');
  el.textContent = message;
  el.className = 'notice' + (kind ? ' ' + kind : '');
  el.hidden = !message;
};
const setBusy = (button, busy, text) => {
  if (!button) return;
  button.disabled = busy;
  if (busy) { button.dataset.originalText = button.textContent; button.textContent = text || 'Please wait…'; }
  else { button.textContent = button.dataset.originalText || button.textContent; }
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

if (!configured) $('configWarning').hidden = false;

document.querySelectorAll('[data-auth-mode]').forEach(button => {
  button.addEventListener('click', () => {
    authMode = button.dataset.authMode;
    document.querySelectorAll('[data-auth-mode]').forEach(b => b.classList.toggle('active', b === button));
    $('authSubmit').textContent = authMode === 'signup' ? 'Create account' : 'Sign in';
    $('password').autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
    showMessage('');
  });
});

$('authForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return showMessage('Portal configuration is incomplete. Add the Supabase publishable/anon key in supabase-config.js.', 'warning');
  const button = $('authSubmit');
  setBusy(button, true, 'Connecting…');
  showMessage('');
  const email = $('email').value.trim();
  const password = $('password').value;
  try {
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
      if (error) throw error;
      if (data.session) {
        await handleSignedIn(data.session.user);
      } else {
        showMessage('Account request received. Check your email for a confirmation link before signing in.');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        await showMfaChallenge('Enter the current code from your authenticator app to finish signing in.');
      } else {
        await handleSignedIn(data.user);
      }
    }
  } catch (error) {
    showMessage(error.message || 'Unable to complete sign-in. Please try again.', 'warning');
  } finally {
    setBusy(button, false);
  }
});

$('mfaForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase || !pendingMfaFactorId) return;
  const button = $('mfaForm').querySelector('button');
  setBusy(button, true, 'Verifying…');
  try {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: pendingMfaFactorId });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: pendingMfaFactorId, challengeId: challenge.id, code: $('mfaCode').value.trim() });
    if (verifyError) throw verifyError;
    const { data } = await supabase.auth.getUser();
    pendingMfaFactorId = null;
    $('mfaForm').reset();
    $('mfaForm').hidden = true;
    $('authForm').hidden = false;
    await handleSignedIn(data.user);
  } catch (error) {
    showMessage(error.message || 'That code could not be verified. Check the current code and try again.', 'warning');
  } finally {
    setBusy(button, false);
  }
});

async function showMfaChallenge(message = 'Enter the current code from your authenticator app to continue.') {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const verified = (factors?.totp || []).find(f => f.status === 'verified');
  if (!verified) throw new Error('This account requires MFA but has no verified authenticator factor. Contact support.');
  pendingMfaFactorId = verified.id;
  $('workspace').hidden = true;
  $('authPanel').hidden = false;
  $('authForm').hidden = true;
  $('mfaForm').hidden = false;
  $('mfaCode').focus();
  showMessage(message);
}

async function handleSignedIn(user) {
  currentUser = user;
  isStaff = false;
  const { data: staff, error: staffError } = await supabase.rpc('is_case_staff');
  if (!staffError) isStaff = staff === true;
  $('authPanel').hidden = true;
  $('workspace').hidden = false;
  $('workspaceTitle').textContent = isStaff ? 'Staff case dashboard' : 'Your cases';
  $('signedInAs').textContent = 'Signed in as ' + user.email + (isStaff ? ' · Staff access' : '');
  $('newCasePanel').hidden = isStaff;
  showMessage(isStaff ? 'Staff session active. Case updates require a verified MFA session.' : 'You are signed in. Your case history is private to your account.');
  await loadCases();
}

$('caseForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase || !currentUser) return;
  const button = $('caseForm').querySelector('button[type="submit"]');
  setBusy(button, true, 'Submitting…');
  try {
    const form = new FormData($('caseForm'));
    const record = {
      user_id: currentUser.id,
      subject: String(form.get('subject') || '').trim(),
      category: String(form.get('category') || '').trim(),
      message: String(form.get('message') || '').trim()
    };
    if (!record.subject || !record.category || !record.message) throw new Error('Please complete all fields.');
    if (record.subject.length < 4) throw new Error('Please make the subject at least 4 characters long.');
    if (record.category.length < 2) throw new Error('Please choose a valid category.');
    if (record.message.length < 10) throw new Error('Please make the message at least 10 characters long.');
    if (record.subject.length > 120) throw new Error('Please keep the subject to 120 characters or fewer.');
    const { error } = await supabase.from('customer_cases').insert(record);
    if (error) throw error;
    $('caseForm').reset();
    showMessage('Your enquiry was submitted successfully.');
    await loadCases();
  } catch (error) {
    showMessage(error.message || 'Unable to submit your enquiry.', 'warning');
  } finally {
    setBusy(button, false);
  }
});

$('refreshCases').addEventListener('click', loadCases);
$('signOut').addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  currentUser = null; isStaff = false; pendingMfaFactorId = null;
  $('workspace').hidden = true; $('authPanel').hidden = false;
  $('authForm').hidden = false; $('mfaForm').hidden = true;
  showMessage('You have signed out.');
});

async function loadCases() {
  if (!supabase || !currentUser) return;
  $('casesList').innerHTML = '<p class="empty">Loading cases…</p>';
  try {
    const { data, error } = await supabase.from('customer_cases').select('id,subject,category,message,status,staff_response,created_at,updated_at').order('created_at', { ascending: false });
    if (error) throw error;
    if (!data?.length) {
      $('casesList').innerHTML = '<p class="empty">No cases yet. Your submitted enquiries will appear here.</p>';
      return;
    }
    $('casesList').innerHTML = data.map(renderCase).join('');
    if (isStaff) {
      $('casesList').querySelectorAll('[data-save-case]').forEach(button => button.addEventListener('click', () => saveStaffUpdate(button.dataset.saveCase)));
    }
  } catch (error) {
    $('casesList').innerHTML = '<p class="empty">Unable to load cases: ' + escapeHtml(error.message || 'Please try again.') + '</p>';
  }
}

function renderCase(item) {
  const id = escapeHtml(item.id);
  const status = escapeHtml(item.status || 'new');
  const created = item.created_at ? new Date(item.created_at).toLocaleString() : 'Date unavailable';
  return `<article class="case-card" data-case-id="${id}">
    <div class="case-card-head"><div><h4>${escapeHtml(item.subject)}</h4><div class="case-meta">Case ${id.slice(0,8)} · Created ${escapeHtml(created)}</div></div><span class="status">${status.replace(/_/g,' ')}</span></div>
    <p class="case-category">${escapeHtml(item.category)}</p>
    <p class="case-message">${escapeHtml(item.message)}</p>
    ${item.staff_response ? '<div class="response"><strong>Staff response</strong><div class="case-message">' + escapeHtml(item.staff_response) + '</div></div>' : ''}
    ${isStaff ? `<div class="staff-tools"><label for="status-${id}">Update status</label><select id="status-${id}" data-status><option value="new" ${item.status==='new'?'selected':''}>New</option><option value="in_progress" ${item.status==='in_progress'?'selected':''}>In progress</option><option value="waiting_for_customer" ${item.status==='waiting_for_customer'?'selected':''}>Waiting for customer</option><option value="resolved" ${item.status==='resolved'?'selected':''}>Resolved</option><option value="closed" ${item.status==='closed'?'selected':''}>Closed</option></select><label for="response-${id}">Staff response</label><textarea id="response-${id}" data-response rows="3" maxlength="5000" placeholder="Write an update for the customer">${escapeHtml(item.staff_response || '')}</textarea><button class="button primary" type="button" data-save-case="${id}">Save case update</button></div>` : ''}
  </article>`;
}

async function saveStaffUpdate(caseId) {
  const card = $('casesList').querySelector('[data-case-id="' + CSS.escape(caseId) + '"]');
  if (!card || !isStaff) return;
  const button = card.querySelector('[data-save-case]');
  setBusy(button, true, 'Saving…');
  try {
    const status = card.querySelector('[data-status]').value;
    const staff_response = card.querySelector('[data-response]').value.trim() || null;
    const { error } = await supabase.from('customer_cases').update({ status, staff_response }).eq('id', caseId);
    if (error) throw error;
    showMessage('Case update saved.');
    await loadCases();
  } catch (error) {
    showMessage(error.message || 'Unable to save the case update.', 'warning');
  } finally {
    setBusy(button, false);
  }
}

if (supabase) {
  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error) return showMessage(error.message, 'warning');
    if (data.session?.user) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        try {
          await showMfaChallenge('Your staff session needs authenticator verification. Enter your current six-digit code to continue.');
        } catch (mfaError) {
          showMessage(mfaError.message || 'Unable to start MFA verification. Please sign in again.', 'warning');
        }
      } else {
        await handleSignedIn(data.session.user);
      }
    }
  });
}