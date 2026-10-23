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
let pendingSetupFactorId = null;
let signingOut = false;

const showMessage = (message, kind = '') => {
  const el = $('message');
  if (!el) return;
  el.textContent = message;
  el.className = 'notice' + (kind ? ' ' + kind : '');
  el.hidden = !message;
};

const setBusy = (button, busy, text) => {
  if (!button) return;
  if (busy) {
    if (!button.disabled) button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = text || 'Please wait…';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

if (!configured && $('configWarning')) {
  $('configWarning').hidden = false;
}

// Add a staff-only authenticator setup panel using the existing portal.html.
function ensureMfaSetupPanel() {
  let panel = $('mfaSetupPanel');
  if (panel) return panel;

  panel = document.createElement('section');
  panel.id = 'mfaSetupPanel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'mfaSetupTitle');
  panel.style.cssText =
    'max-width:680px;margin:1.25rem auto;padding:1.25rem;' +
    'border:1px solid #d8dee8;border-radius:14px;' +
    'background:#fff;color:#172033;';

  panel.innerHTML = `
    <h2 id="mfaSetupTitle">Secure your staff account</h2>
    <p>Your staff account has no verified authenticator. Set up OneAuth or another TOTP authenticator before using staff functions.</p>
    <button id="startMfaSetup" class="button primary" type="button">Set up authenticator</button>
    <div id="mfaSetupInstructions" hidden>
      <p>In OneAuth, choose the option to add an authenticator account and scan this QR code. If scanning is unavailable, enter the setup key shown below manually.</p>
      <img id="mfaSetupQr" alt="Authenticator setup QR code" style="display:block;max-width:240px;width:100%;height:auto;margin:1rem 0;border:1px solid #e5e7eb;padding:8px;background:#fff;" />
      <p><strong>Manual setup key</strong></p>
      <code id="mfaSetupSecret" style="display:block;overflow-wrap:anywhere;padding:.75rem;background:#f3f4f6;border-radius:8px;user-select:all;"></code>
      <form id="mfaSetupForm" style="margin-top:1rem;">
        <label for="mfaSetupCode">Enter the current six-digit code from your authenticator</label>
        <input id="mfaSetupCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required />
        <button id="verifyMfaSetup" class="button primary" type="submit">Verify and secure account</button>
      </form>
      <p id="mfaSetupHelp" role="status" aria-live="polite"></p>
    </div>`;

  const anchor = $('authPanel') || $('workspace') || document.body;
  anchor.insertAdjacentElement('afterend', panel);
  $('startMfaSetup').addEventListener('click', startMfaEnrollment);
  $('mfaSetupForm').addEventListener('submit', verifyMfaEnrollment);
  return panel;
}

function hideMfaSetupPanel() {
  const panel = $('mfaSetupPanel');
  if (panel) panel.hidden = true;
}

function showMfaSetup(message = 'Set up a new authenticator to continue.') {
  const panel = ensureMfaSetupPanel();
  panel.hidden = false;
  $('workspace').hidden = true;
  if ($('authPanel')) $('authPanel').hidden = true;
  showMessage(message, 'warning');
  $('startMfaSetup').focus();
}

async function startMfaEnrollment() {
  if (!supabase || !currentUser || !isStaff) {
    showMessage('Please sign in to the staff account before setting up an authenticator.', 'warning');
    return;
  }

  const button = $('startMfaSetup');
  setBusy(button, true, 'Preparing setup…');

  try {
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;

    const verified = (factors?.totp || []).find(f => f.status === 'verified');
    if (verified) {
      showMessage('A verified authenticator already exists. Please sign out and sign in again to verify it.', 'warning');
      return;
    }

    // Do not automatically remove factors. That could remove an authenticator
    // the account owner still needs. Enrol a new factor instead.
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'RHP Staff OneAuth'
    });
    if (error) throw error;

    if (!data?.id || !data?.totp?.qr_code || !data?.totp?.secret) {
      throw new Error('Supabase did not return the authenticator setup details. Please try again or contact support.');
    }

    pendingSetupFactorId = data.id;
    $('mfaSetupQr').src = data.totp.qr_code;
    $('mfaSetupSecret').textContent = data.totp.secret;
    $('mfaSetupInstructions').hidden = false;
    $('mfaSetupHelp').textContent = 'Keep this setup key private. After adding the account to OneAuth, enter its current six-digit code below.';
    $('mfaSetupCode').focus();
  } catch (error) {
    showMessage(error.message || 'Unable to start authenticator setup.', 'warning');
  } finally {
    setBusy(button, false);
  }
}

async function verifyMfaEnrollment(event) {
  event.preventDefault();
  if (!supabase || !pendingSetupFactorId) {
    showMessage('Start authenticator setup first.', 'warning');
    return;
  }

  const button = $('verifyMfaSetup');
  const code = $('mfaSetupCode').value.trim();
  if (!/^\d{6}$/.test(code)) {
    $('mfaSetupHelp').textContent = 'Enter the six-digit code displayed in your authenticator app.';
    return;
  }

  setBusy(button, true, 'Verifying…');
  try {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: pendingSetupFactorId
    });
    if (challengeError) throw challengeError;

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pendingSetupFactorId,
      challengeId: challenge.id,
      code
    });
    if (verifyError) throw verifyError;

    pendingSetupFactorId = null;
    $('mfaSetupForm').reset();
    $('mfaSetupPanel').hidden = true;
    $('mfaSetupInstructions').hidden = true;

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;

    if (aal?.currentLevel !== 'aal2') {
      await supabase.auth.signOut();
      currentUser = null;
      isStaff = false;
      $('workspace').hidden = true;
      $('authPanel').hidden = false;
      $('authForm').hidden = false;
      $('mfaForm').hidden = true;
      showMessage('Your authenticator is enrolled. Please sign in again and enter its six-digit code to finish securing your staff session.', 'success');
      return;
    }

    showMessage('Authenticator verified. Your staff session is protected with MFA.', 'success');
    await handleSignedIn(currentUser);
  } catch (error) {
    const message = error.message || 'That code could not be verified. Check the current code and try again.';
    const panel = $('mfaSetupPanel');
    if (panel && !panel.hidden && $('mfaSetupHelp')) {
      $('mfaSetupHelp').textContent = message;
    } else {
      showMessage(message, 'warning');
    }
  } finally {
    setBusy(button, false);
  }
}

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
  if (!supabase) {
    return showMessage('Portal configuration is incomplete. Add the Supabase publishable/anon key in supabase-config.js.', 'warning');
  }

  const button = $('authSubmit');
  setBusy(button, true, 'Connecting…');
  showMessage('');
  const email = $('email').value.trim();
  const password = $('password').value;

  try {
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
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
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pendingMfaFactorId,
      challengeId: challenge.id,
      code: $('mfaCode').value.trim()
    });
    if (verifyError) throw verifyError;

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
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

  if (!verified) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    await handleSignedIn(userData.user);
    return;
  }

  pendingMfaFactorId = verified.id;
  hideMfaSetupPanel();
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
  if (staffError) throw staffError;
  isStaff = staff === true;

  if (isStaff) {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const verified = (factors?.totp || []).some(f => f.status === 'verified');
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;

    if (!verified) {
      showMfaSetup('Your staff account has no verified authenticator. Set one up to continue.');
      return;
    }
    if (aal?.currentLevel !== 'aal2') {
      await showMfaChallenge('Your staff session needs authenticator verification. Enter your current six-digit code to continue.');
      return;
    }
  }

  hideMfaSetupPanel();
  $('authPanel').hidden = true;
  $('workspace').hidden = false;
  $('workspaceTitle').textContent = isStaff ? 'Staff case dashboard' : 'Your cases';
  $('signedInAs').textContent = 'Signed in as ' + user.email + (isStaff ? ' · Staff access · MFA verified' : '');
  $('newCasePanel').hidden = isStaff;
  showMessage(isStaff
    ? 'Staff session active. MFA is verified for this session.'
    : 'You are signed in. Your case history is private to your account.');
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
  signingOut = true;
  if (supabase) await supabase.auth.signOut();
  currentUser = null;
  isStaff = false;
  pendingMfaFactorId = null;
  pendingSetupFactorId = null;
  hideMfaSetupPanel();
  $('workspace').hidden = true;
  $('authPanel').hidden = false;
  $('authForm').hidden = false;
  $('mfaForm').hidden = true;
  showMessage('You have signed out.');
  signingOut = false;
});

async function loadCases() {
  if (!supabase || !currentUser) return;
  $('casesList').innerHTML = '<p class="empty">Loading cases…</p>';

  try {
    const { data, error } = await supabase.from('customer_cases')
      .select('id,subject,category,message,status,staff_response,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      $('casesList').innerHTML = '<p class="empty">No cases yet. Your submitted enquiries will appear here.</p>';
      return;
    }

    $('casesList').innerHTML = data.map(renderCase).join('');
    if (isStaff) {
      $('casesList').querySelectorAll('[data-save-case]').forEach(button => {
        button.addEventListener('click', () => saveStaffUpdate(button.dataset.saveCase));
      });
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
  if (!card || !isStaff || !supabase) return;

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== 'aal2') {
    showMessage('Case updates are blocked until you verify your authenticator. Please sign in again and complete MFA.', 'warning');
    return;
  }

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
    if (!data.session?.user) return;

    try {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
        await showMfaChallenge('Your staff session needs authenticator verification. Enter your current six-digit code to continue.');
      } else {
        await handleSignedIn(data.session.user);
      }
    } catch (sessionError) {
      showMessage(sessionError.message || 'Unable to restore your session. Please sign in again.', 'warning');
    }
  });

  supabase.auth.onAuthStateChange((_event, _session) => {
    // The initial session handler renders the page. Leave token-refresh events
    // alone to avoid interrupting an in-progress MFA challenge or case update.
    if (signingOut) return;
  });
}
