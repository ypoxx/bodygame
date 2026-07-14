const STORAGE_KEY = "aq3d.telemetry";
const MAX_EVENTS = 600;

export function createTelemetry() {
  let events = loadEvents();

  function track(name, payload = {}) {
    const entry = {
      name,
      payload,
      timestamp: Date.now(),
    };
    events.push(entry);
    if (events.length > MAX_EVENTS) {
      events = events.slice(events.length - MAX_EVENTS);
    }
    persistEvents(events);
  }

  function getEvents() {
    return [...events];
  }

  function summarize() {
    const summary = {
      total: events.length,
      byEvent: {},
    };

    for (const event of events) {
      summary.byEvent[event.name] = (summary.byEvent[event.name] || 0) + 1;
    }

    return summary;
  }

  function clear() {
    events = [];
    persistEvents(events);
  }

  return {
    track,
    getEvents,
    summarize,
    clear,
  };
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // optional persistence
  }
}
