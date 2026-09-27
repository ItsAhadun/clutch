// chrome.storage.local only — never sync, that would ship live session tokens to Google.
// accounts: { [ds_user_id]: { label, jar, dead, username? } }
const DEFAULTS = {
  accounts: {},
  active: null,
  identityNames: null,
  settings: { goHome: true, clearStorage: false },
};

export const getState = () => chrome.storage.local.get(DEFAULTS);
export const setState = patch => chrome.storage.local.set(patch);
