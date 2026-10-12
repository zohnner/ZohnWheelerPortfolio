// The AI's reflexes: an idle nudge, memory of the last project, one remark on
// repeat interest, an honest heads-up when a project is down, and the
// screensaver. Any visitor input resets the timers and dismisses the saver.

export function createReactions({ operator, store, getState, screensaver, projectById, setAlert, nudgeMs = 45000, saverMs = 90000 }) {
  const seen = new Set();
  let started = false;
  let nudged = false;
  let remarked = false;
  let nudgeTimer = null;
  let saverTimer = null;

  function nudgeText(state) {
    if (state.track === 'build') return "Still there? Try 'open sitekit', or ask me something in plain English.";
    if (state.track === 'hire') return "Still there? Try 'scan sportstrata', or 'man zohn' for the short version.";
    return "Still there? Pick a track above, or type 'help'.";
  }

  function schedule() {
    clearTimeout(nudgeTimer);
    clearTimeout(saverTimer);
    if (!started) return;
    if (!nudged) {
      nudgeTimer = setTimeout(() => {
        if (document.hidden) return;
        nudged = true;
        operator.say(nudgeText(getState()));
      }, nudgeMs);
    }
    saverTimer = setTimeout(() => {
      if (document.hidden || getState().focused) return;
      screensaver.start();
    }, saverMs);
  }

  function activity() {
    if (screensaver.active) screensaver.stop();
    schedule();
  }

  return {
    start() {
      if (started) return;
      started = true;
      for (const type of ['keydown', 'pointerdown', 'wheel', 'touchstart']) addEventListener(type, activity, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) screensaver.stop();
        else schedule();
      });
      schedule();
    },
    welcomeLine() {
      const id = store.get('zw_last_project');
      const p = id ? projectById.get(id) : null;
      return p ? `Welcome back. Last time you looked at ${p.name}.` : 'welcome';
    },
    projectOpened(id) {
      const p = projectById.get(id);
      if (!p) return;
      store.set('zw_last_project', id);
      if (seen.has(id) && !remarked) {
        remarked = true;
        operator.say(`Back to ${p.name}. It does tend to pull people in.`);
      }
      seen.add(id);
    },
    checkHealth(status) {
      const down = (status?.projects ?? []).filter((s) => s.status === 'down').map((s) => projectById.get(s.id)?.name ?? s.id);
      if (!down.length) return;
      setAlert(true);
      operator.say(`Heads up: ${down.join(' and ')} ${down.length > 1 ? 'are' : 'is'} not responding right now. That's live data, not a script.`);
    },
  };
}
