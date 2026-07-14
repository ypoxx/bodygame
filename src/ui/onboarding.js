const STORAGE_KEY = "aq3d.onboardingCompleted.mobileV2";

export function createOnboarding(options = {}) {
  const { onDone = () => {} } = options;
  let mounted = false;
  let index = 0;

  const steps = [
    {
      title: "Willkommen bei AnatomyQuest",
      body: "Drehe den Körper mit einem Finger und zoome mit zwei Fingern an kleine Strukturen heran.",
    },
    {
      title: "Deine Lernrunde",
      body: "Wähle Modus und Ebene. In der Runde bleibt nur das kompakte Aktionsdock sichtbar.",
    },
    {
      title: "Knochen, Muskeln, Faszien",
      body: "Wechsle zwischen den anatomischen Ebenen und tippe eine Struktur für Details an.",
    },
  ];

  const overlay = document.createElement("div");
  overlay.className = "results-modal hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "onboardingTitle");

  const card = document.createElement("div");
  card.className = "results-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Kurze Einführung";

  const title = document.createElement("h2");
  title.id = "onboardingTitle";
  const body = document.createElement("p");
  body.className = "fact";

  const controls = document.createElement("div");
  controls.className = "control-row";

  const skipBtn = document.createElement("button");
  skipBtn.className = "btn btn-secondary";
  skipBtn.type = "button";
  skipBtn.textContent = "Überspringen";

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-primary";
  nextBtn.type = "button";
  nextBtn.textContent = "Weiter";

  controls.append(skipBtn, nextBtn);
  card.append(eyebrow, title, body, controls);
  overlay.append(card);

  function mount() {
    if (mounted) {
      return;
    }
    document.body.append(overlay);
    mounted = true;

    skipBtn.addEventListener("click", complete);
    nextBtn.addEventListener("click", () => {
      if (index < steps.length - 1) {
        index += 1;
        render();
      } else {
        complete();
      }
    });

    document.addEventListener("keydown", handleKeydown);
  }

  function render() {
    const step = steps[index];
    title.textContent = step.title;
    body.textContent = step.body;
    nextBtn.textContent = index < steps.length - 1 ? "Weiter" : "Start";
  }

  function showIfNeeded() {
    mount();
    if (isCompleted()) {
      return false;
    }
    index = 0;
    render();
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      nextBtn.focus();
    }, 0);
    return true;
  }

  function complete() {
    markCompleted();
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    onDone();
  }

  function handleKeydown(event) {
    if (overlay.classList.contains("hidden")) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      complete();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusables = [skipBtn, nextBtn];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function isCompleted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  function markCompleted() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // optional persistence
    }
  }

  return {
    showIfNeeded,
    complete,
    isCompleted,
  };
}
