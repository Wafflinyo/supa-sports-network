// Auth sessions are stored in the current browser tab unless the user
// explicitly opts in to keeping the league account signed in across visits.
// The standard Supabase key is retained to restore existing signed-in users.
export function createLeagueAuthStorage(url, stores = {}) {
  const authKey = 'sb-' + new URL(url).hostname.split('.')[0] + '-auth-token';
  const durable = stores.local || window.localStorage;
  const temporary = stores.session || window.sessionStorage;
  let remember = temporary.getItem(authKey) == null && durable.getItem(authKey) != null;
  const storage = {
    getItem(key) {
      return temporary.getItem(key) ?? durable.getItem(key);
    },
    setItem(key, value) {
      const destination = remember ? durable : temporary;
      const other = remember ? temporary : durable;
      destination.setItem(key, value);
      other.removeItem(key);
    },
    removeItem(key) {
      temporary.removeItem(key);
      durable.removeItem(key);
    },
  };
  return {
    authKey,
    storage,
    setKeepSignedIn(checked) {
      const active = storage.getItem(authKey);
      remember = Boolean(checked);
      if (active != null) storage.setItem(authKey, active);
    },
    getKeepSignedIn() {
      return remember;
    },
  };
}
