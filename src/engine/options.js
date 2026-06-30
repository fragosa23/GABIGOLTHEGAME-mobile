const STORAGE_KEY = 'gabigol_mobile_options_v1';

const DEFAULT_OPTIONS = {
  highPerformance: false,
  menuMusic: true,
  gameplayMusic: true,
};

let options = loadOptions();
const listeners = new Set();

function loadOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS };
    return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_OPTIONS };
  }
}

function saveOptions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch (_) {}
}

export function getOptions() {
  return { ...options };
}

export function setOption(name, value) {
  if (!(name in DEFAULT_OPTIONS)) return;
  options = { ...options, [name]: !!value };
  saveOptions();
  for (const fn of listeners) fn(getOptions());
}

export function toggleOption(name) {
  setOption(name, !options[name]);
}

export function onOptionsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyRendererOptions(renderer, sun = null) {
  const high = options.highPerformance;
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(dpr, high ? 1.25 : 2));
  renderer.shadowMap.enabled = !high;
  renderer.shadowMap.needsUpdate = true;

  if (sun) {
    sun.castShadow = !high;
    if (sun.shadow?.mapSize) sun.shadow.mapSize.set(high ? 1024 : 2048, high ? 1024 : 2048);
    if (sun.shadow) sun.shadow.needsUpdate = true;
  }
}

const OPTION_ROWS = [
  ['highPerformance', 'HIGH PERFORMANCE'],
  ['menuMusic', 'MÚSICA MENU'],
  ['gameplayMusic', 'MÚSICA JOGO'],
];

export function makeOptionsPanel({ title = 'OPÇÕES', onClose = null } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;
    background:#050913dd;backdrop-filter:blur(6px);font-family:system-ui,sans-serif;color:#fff;pointer-events:auto;`;

  const panel = document.createElement('div');
  panel.style.cssText = `width:min(86vw,430px);display:flex;flex-direction:column;gap:12px;background:#071226ee;
    border:2px solid #ffffff55;border-radius:18px;padding:clamp(16px,4vw,26px);box-shadow:0 16px 46px #000b;`;

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = `font-size:clamp(22px,5vw,34px);font-weight:900;text-align:center;letter-spacing:1px;margin-bottom:4px;`;
  panel.appendChild(heading);

  const refresh = () => {
    const o = getOptions();
    for (const btn of panel.querySelectorAll('[data-option]')) {
      const enabled = !!o[btn.dataset.option];
      btn.querySelector('.state').textContent = enabled ? 'ON' : 'OFF';
      btn.style.background = enabled ? 'linear-gradient(180deg,#276b3b,#15351f)' : 'linear-gradient(180deg,#703038,#35151a)';
      btn.style.borderColor = enabled ? '#9dff6acc' : '#ff8b8bcc';
    }
  };

  for (const [key, label] of OPTION_ROWS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.option = key;
    btn.innerHTML = `<span>${label}</span><span class="state">ON</span>`;
    btn.style.cssText = `cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:18px;
      width:100%;font-size:clamp(14px,3vw,18px);font-weight:900;color:#fff;border:2px solid #ffffff66;
      border-radius:999px;padding:clamp(10px,2vh,14px) clamp(16px,4vw,24px);box-shadow:0 8px 22px #0007;`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleOption(key);
      refresh();
    });
    panel.appendChild(btn);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'VOLTAR';
  close.style.cssText = `cursor:pointer;margin-top:8px;width:100%;font-size:clamp(14px,3vw,18px);font-weight:900;
    color:#e8f5ff;background:#0b1020;border:2px solid #ffffff88;border-radius:999px;
    padding:clamp(10px,2vh,14px) clamp(18px,5vw,32px);`;
  close.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.remove();
    onClose && onClose();
  });
  panel.appendChild(close);

  overlay.appendChild(panel);
  refresh();
  document.body.appendChild(overlay);
  return overlay;
}
