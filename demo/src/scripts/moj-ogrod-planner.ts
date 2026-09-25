type PlantState = {
  id: string;
  name: string;
  latin?: string;
  short: string;
  x: number;
  y: number;
  spacing: number;
};

type BedState = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Selection =
  | { type: 'plant'; id: string }
  | { type: 'bed'; id: string }
  | null;

type PlannerState = {
  zoom: number;
  snap: boolean;
  plants: PlantState[];
  beds: BedState[];
  selected: Selection;
};

const STORAGE_KEY = 'moj-ogrod-planner-v2';
const SNAP_STEP = 2;

const initialPlants: PlantState[] = [
  { id: 'p1', name: 'Hortensja bukietowa', short: 'H', x: 22, y: 25, spacing: 90 },
  { id: 'p2', name: 'Sosna bośniacka Compact Gem', short: 'S', x: 34, y: 30, spacing: 120 },
  { id: 'p3', name: 'Paproć ogrodowa', short: 'P', x: 72, y: 29, spacing: 55 },
  { id: 'p4', name: 'Hakonechloa smukła', short: 'Ha', x: 80, y: 39, spacing: 50 },
  { id: 'p5', name: 'Żurawka', short: 'Ż', x: 38, y: 75, spacing: 35 },
  { id: 'p6', name: 'Funkia', short: 'F', x: 53, y: 76, spacing: 60 },
];

const initialBeds: BedState[] = [
  { id: 'b1', name: 'Rabata frontowa', x: 15, y: 18, width: 31, height: 24 },
  { id: 'b2', name: 'Rabata cienista', x: 61, y: 20, width: 26, height: 31 },
  { id: 'b3', name: 'Rabata przy tarasie', x: 24, y: 65, width: 44, height: 20 },
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const defaultState: PlannerState = {
  zoom: 1,
  snap: true,
  plants: clone(initialPlants),
  beds: clone(initialBeds),
  selected: { type: 'plant', id: 'p1' },
};

const loadState = (): PlannerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(defaultState);
    const parsed = JSON.parse(raw) as Partial<PlannerState>;
    return {
      zoom: Math.min(1.8, Math.max(0.6, parsed.zoom || 1)),
      snap: parsed.snap ?? true,
      plants: Array.isArray(parsed.plants) ? parsed.plants : clone(initialPlants),
      beds: Array.isArray(parsed.beds) ? parsed.beds : clone(initialBeds),
      selected: parsed.selected ?? null,
    };
  } catch {
    return clone(defaultState);
  }
};

const state = loadState();

const scene = document.querySelector<HTMLElement>('[data-planner-scene]');
const zoomLabel = document.querySelector<HTMLElement>('[data-zoom-label]');
const saveBadge = document.querySelector<HTMLElement>('[data-save-badge]');
const inspectorTitle = document.querySelector<HTMLElement>('[data-inspector-title]');
const inspectorType = document.querySelector<HTMLElement>('[data-inspector-type]');
const inspectorKind = document.querySelector<HTMLElement>('[data-inspector-kind]');
const inspectorPosition = document.querySelector<HTMLElement>('[data-inspector-position]');
const inspectorSpacing = document.querySelector<HTMLElement>('[data-inspector-spacing]');
const inspectorCollision = document.querySelector<HTMLElement>('[data-inspector-collision]');
const bedWidth = document.querySelector<HTMLElement>('[data-bed-width]');
const bedHeight = document.querySelector<HTMLElement>('[data-bed-height]');
const bedPosition = document.querySelector<HTMLElement>('[data-bed-position]');
const kpiBeds = document.querySelector<HTMLElement>('[data-kpi-beds]');
const kpiPlants = document.querySelector<HTMLElement>('[data-kpi-plants]');
const kpiCollisions = document.querySelector<HTMLElement>('[data-kpi-collisions]');
const collisionBadge = document.querySelector<HTMLElement>('[data-collision-badge]');
const collisionNote = document.querySelector<HTMLElement>('[data-collision-note]');
const analysisScore = document.querySelector<HTMLElement>('[data-analysis-score]');
const analysisProgress = document.querySelector<HTMLElement>('[data-analysis-progress]');
const analysisCopy = document.querySelector<HTMLElement>('[data-analysis-copy]');
const snapState = document.querySelector<HTMLElement>('[data-snap-state]');
const snapButton = document.querySelector<HTMLElement>('[data-toggle-snap]');

if (!scene || !zoomLabel || !saveBadge) throw new Error('Planner UI is incomplete.');

let interaction:
  | { type: 'plant'; id: string; offsetX: number; offsetY: number }
  | { type: 'bed'; id: string; offsetX: number; offsetY: number }
  | { type: 'resize'; id: string; startX: number; startY: number; startW: number; startH: number }
  | null = null;

let saveTimer = 0;

const snap = (value: number) => state.snap ? Math.round(value / SNAP_STEP) * SNAP_STEP : value;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const scheduleSave = () => {
  saveBadge.textContent = 'zapisywanie…';
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveBadge.textContent = 'zapisano';
  }, 220);
};

const applyZoom = () => {
  scene.style.transform = `scale(${state.zoom})`;
  zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
};

const setPlantPosition = (el: HTMLElement, plant: PlantState) => {
  el.style.left = `${plant.x}%`;
  el.style.top = `${plant.y}%`;
};

const setBedGeometry = (el: HTMLElement, bed: BedState) => {
  el.style.left = `${bed.x}%`;
  el.style.top = `${bed.y}%`;
  el.style.width = `${bed.width}%`;
  el.style.height = `${bed.height}%`;
};

const createPlantElement = (plant: PlantState) => {
  const button = document.createElement('button');
  button.className = 'plant-dot';
  button.dataset.plantId = plant.id;
  button.title = plant.name;
  button.textContent = plant.short;
  setPlantPosition(button, plant);
  scene.appendChild(button);
};

const createBedElement = (bed: BedState) => {
  const button = document.createElement('button');
  button.className = 'bed dynamic-bed';
  button.dataset.bedId = bed.id;
  button.setAttribute('aria-label', bed.name);
  button.innerHTML = `<span class="bed-label">${bed.name}</span><span class="resize-handle" data-resize-bed="${bed.id}" aria-hidden="true"></span>`;
  setBedGeometry(button, bed);
  scene.appendChild(button);
};

const getCollisionIds = () => {
  const ids = new Set<string>();
  for (let i = 0; i < state.plants.length; i += 1) {
    for (let j = i + 1; j < state.plants.length; j += 1) {
      const a = state.plants[i];
      const b = state.plants[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distancePercent = Math.sqrt(dx * dx + dy * dy);
      const requiredPercent = Math.max(4, ((a.spacing + b.spacing) / 2) / 18);
      if (distancePercent < requiredPercent) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
};

const renderAnalysis = () => {
  const collisionIds = getCollisionIds();
  document.querySelectorAll<HTMLElement>('[data-plant-id]').forEach((el) => {
    el.classList.toggle('collision', collisionIds.has(el.dataset.plantId || ''));
  });

  const collisionCount = collisionIds.size;
  const score = Math.max(40, 100 - collisionCount * 8);
  if (kpiBeds) kpiBeds.textContent = String(state.beds.length);
  if (kpiPlants) kpiPlants.textContent = String(state.plants.length);
  if (kpiCollisions) kpiCollisions.textContent = String(collisionCount);
  if (collisionBadge) collisionBadge.textContent = `${collisionCount} ${collisionCount === 1 ? 'kolizja' : 'kolizji'}`;
  if (collisionNote) collisionNote.textContent = collisionCount
    ? 'Czerwone obrysy wskazują rośliny ustawione zbyt blisko siebie względem deklarowanego rozstawu.'
    : 'Brak konfliktów rozstawu.';
  if (analysisScore) analysisScore.textContent = `${score}%`;
  if (analysisProgress) analysisProgress.style.width = `${score}%`;
  if (analysisCopy) analysisCopy.textContent = collisionCount
    ? `Wykryto ${collisionCount} roślin wymagających korekty rozstawu. Przesuń elementy oznaczone czerwonym obrysem.`
    : 'Aktualny układ nie zawiera konfliktów rozstawu.';
  if (inspectorCollision && state.selected?.type === 'plant') {
    inspectorCollision.textContent = collisionIds.has(state.selected.id) ? 'tak' : 'nie';
  }
};

const renderSelection = () => {
  document.querySelectorAll<HTMLElement>('[data-plant-id]').forEach((el) => {
    el.classList.toggle('selected', state.selected?.type === 'plant' && el.dataset.plantId === state.selected.id);
  });
  document.querySelectorAll<HTMLElement>('[data-bed-id]').forEach((el) => {
    el.classList.toggle('selected', state.selected?.type === 'bed' && el.dataset.bedId === state.selected.id);
  });

  const plant = state.selected?.type === 'plant'
    ? state.plants.find((item) => item.id === state.selected?.id)
    : undefined;
  const bed = state.selected?.type === 'bed'
    ? state.beds.find((item) => item.id === state.selected?.id)
    : undefined;

  if (plant) {
    if (inspectorTitle) inspectorTitle.textContent = plant.name;
    if (inspectorType) inspectorType.textContent = 'roślina';
    if (inspectorKind) inspectorKind.textContent = plant.latin || 'roślina';
    if (inspectorPosition) inspectorPosition.textContent = `${Math.round(plant.x)} × ${Math.round(plant.y)}`;
    if (inspectorSpacing) inspectorSpacing.textContent = `${plant.spacing} cm`;
    if (bedWidth) bedWidth.textContent = '—';
    if (bedHeight) bedHeight.textContent = '—';
    if (bedPosition) bedPosition.textContent = '—';
  } else if (bed) {
    if (inspectorTitle) inspectorTitle.textContent = bed.name;
    if (inspectorType) inspectorType.textContent = 'rabata';
    if (inspectorKind) inspectorKind.textContent = 'obszar';
    if (inspectorPosition) inspectorPosition.textContent = `${Math.round(bed.x)} × ${Math.round(bed.y)}`;
    if (inspectorSpacing) inspectorSpacing.textContent = '—';
    if (inspectorCollision) inspectorCollision.textContent = '—';
    if (bedWidth) bedWidth.textContent = `${Math.round(bed.width)}%`;
    if (bedHeight) bedHeight.textContent = `${Math.round(bed.height)}%`;
    if (bedPosition) bedPosition.textContent = `${Math.round(bed.x)} × ${Math.round(bed.y)}`;
  } else {
    if (inspectorTitle) inspectorTitle.textContent = 'Plan ogrodu';
    if (inspectorType) inspectorType.textContent = 'projekt';
    if (inspectorKind) inspectorKind.textContent = 'projekt';
    if (inspectorPosition) inspectorPosition.textContent = '—';
    if (inspectorSpacing) inspectorSpacing.textContent = '—';
    if (inspectorCollision) inspectorCollision.textContent = '—';
  }

  renderAnalysis();
};

const syncScene = () => {
  scene.querySelectorAll('[data-plant-id],[data-bed-id]').forEach((el) => el.remove());
  state.beds.forEach(createBedElement);
  state.plants.forEach(createPlantElement);
  renderSelection();
};

const select = (selection: Selection) => {
  state.selected = selection;
  renderSelection();
  scheduleSave();
};

scene.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement;
  const resize = target.closest<HTMLElement>('[data-resize-bed]');
  if (resize) {
    const id = resize.dataset.resizeBed;
    const bed = state.beds.find((item) => item.id === id);
    if (!id || !bed) return;
    interaction = {
      type: 'resize',
      id,
      startX: event.clientX,
      startY: event.clientY,
      startW: bed.width,
      startH: bed.height,
    };
    select({ type: 'bed', id });
    resize.setPointerCapture(event.pointerId);
    return;
  }

  const plantEl = target.closest<HTMLElement>('[data-plant-id]');
  if (plantEl?.dataset.plantId) {
    const rect = plantEl.getBoundingClientRect();
    interaction = {
      type: 'plant',
      id: plantEl.dataset.plantId,
      offsetX: event.clientX - rect.left - rect.width / 2,
      offsetY: event.clientY - rect.top - rect.height / 2,
    };
    plantEl.setPointerCapture(event.pointerId);
    plantEl.classList.add('dragging');
    select({ type: 'plant', id: plantEl.dataset.plantId });
    return;
  }

  const bedEl = target.closest<HTMLElement>('[data-bed-id]');
  if (bedEl?.dataset.bedId) {
    const rect = bedEl.getBoundingClientRect();
    interaction = {
      type: 'bed',
      id: bedEl.dataset.bedId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    bedEl.setPointerCapture(event.pointerId);
    bedEl.classList.add('dragging');
    select({ type: 'bed', id: bedEl.dataset.bedId });
    return;
  }

  select(null);
});

scene.addEventListener('pointermove', (event) => {
  if (!interaction) return;
  const rect = scene.getBoundingClientRect();

  if (interaction.type === 'plant') {
    const plant = state.plants.find((item) => item.id === interaction?.id);
    const el = scene.querySelector<HTMLElement>(`[data-plant-id="${interaction.id}"]`);
    if (!plant || !el) return;
    const x = ((event.clientX - rect.left - interaction.offsetX) / rect.width) * 100;
    const y = ((event.clientY - rect.top - interaction.offsetY) / rect.height) * 100;
    plant.x = clamp(snap(x), 2, 98);
    plant.y = clamp(snap(y), 3, 97);
    setPlantPosition(el, plant);
  }

  if (interaction.type === 'bed') {
    const bed = state.beds.find((item) => item.id === interaction?.id);
    const el = scene.querySelector<HTMLElement>(`[data-bed-id="${interaction.id}"]`);
    if (!bed || !el) return;
    const x = ((event.clientX - rect.left - interaction.offsetX) / rect.width) * 100;
    const y = ((event.clientY - rect.top - interaction.offsetY) / rect.height) * 100;
    bed.x = clamp(snap(x), 1, 99 - bed.width);
    bed.y = clamp(snap(y), 1, 99 - bed.height);
    setBedGeometry(el, bed);
  }

  if (interaction.type === 'resize') {
    const bed = state.beds.find((item) => item.id === interaction?.id);
    const el = scene.querySelector<HTMLElement>(`[data-bed-id="${interaction.id}"]`);
    if (!bed || !el) return;
    const dx = ((event.clientX - interaction.startX) / rect.width) * 100;
    const dy = ((event.clientY - interaction.startY) / rect.height) * 100;
    bed.width = clamp(snap(interaction.startW + dx), 10, 98 - bed.x);
    bed.height = clamp(snap(interaction.startH + dy), 10, 98 - bed.y);
    setBedGeometry(el, bed);
  }

  renderSelection();
  scheduleSave();
});

const stopInteraction = () => {
  document.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
  interaction = null;
};

scene.addEventListener('pointerup', stopInteraction);
scene.addEventListener('pointercancel', stopInteraction);

const setZoom = (next: number) => {
  state.zoom = Math.max(0.6, Math.min(1.8, next));
  applyZoom();
  scheduleSave();
};

document.querySelector('[data-zoom-in]')?.addEventListener('click', () => setZoom(state.zoom + 0.1));
document.querySelector('[data-zoom-out]')?.addEventListener('click', () => setZoom(state.zoom - 0.1));
document.querySelector('[data-zoom-reset]')?.addEventListener('click', () => setZoom(1));
document.querySelector('[data-fit]')?.addEventListener('click', () => setZoom(0.9));

document.querySelector('[data-toggle-snap]')?.addEventListener('click', () => {
  state.snap = !state.snap;
  if (snapButton) snapButton.textContent = `Snap: ${state.snap ? 'ON' : 'OFF'}`;
  if (snapState) snapState.textContent = state.snap ? '10 px' : 'wyłączony';
  scheduleSave();
});

document.querySelector('[data-add-plant]')?.addEventListener('click', () => {
  const plant: PlantState = {
    id: `p${Date.now()}`,
    name: 'Nowa roślina',
    short: '+',
    x: 50,
    y: 50,
    spacing: 50,
  };
  state.plants.push(plant);
  state.selected = { type: 'plant', id: plant.id };
  createPlantElement(plant);
  renderSelection();
  scheduleSave();
});

document.querySelector('[data-add-bed]')?.addEventListener('click', () => {
  const bed: BedState = {
    id: `b${Date.now()}`,
    name: `Nowa rabata ${state.beds.length + 1}`,
    x: 38,
    y: 38,
    width: 24,
    height: 18,
  };
  state.beds.push(bed);
  state.selected = { type: 'bed', id: bed.id };
  createBedElement(bed);
  renderSelection();
  scheduleSave();
});

document.querySelectorAll<HTMLElement>('[data-library-item]').forEach((item) => {
  item.addEventListener('click', () => {
    const plant: PlantState = {
      id: `p${Date.now()}`,
      name: item.dataset.libraryName || 'Roślina',
      latin: item.dataset.libraryLatin,
      short: item.dataset.libraryShort || 'R',
      spacing: Number(item.dataset.librarySpacing || 50),
      x: 50,
      y: 50,
    };
    state.plants.push(plant);
    state.selected = { type: 'plant', id: plant.id };
    createPlantElement(plant);
    renderSelection();
    scheduleSave();
  });
});

document.querySelector<HTMLInputElement>('[data-library-search]')?.addEventListener('input', (event) => {
  const query = (event.currentTarget.value || '').trim().toLowerCase();
  document.querySelectorAll<HTMLElement>('[data-library-item]').forEach((item) => {
    const haystack = `${item.dataset.libraryName || ''} ${item.dataset.libraryLatin || ''}`.toLowerCase();
    item.hidden = Boolean(query) && !haystack.includes(query);
  });
});

document.querySelector('[data-auto-layout]')?.addEventListener('click', () => {
  const cols = Math.ceil(Math.sqrt(state.plants.length));
  state.plants.forEach((plant, index) => {
    plant.x = snap(20 + (index % cols) * 16);
    plant.y = snap(22 + Math.floor(index / cols) * 16);
  });
  syncScene();
  scheduleSave();
});

document.querySelector('[data-reset-project]')?.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, clone(defaultState));
  syncScene();
  applyZoom();
  if (snapButton) snapButton.textContent = 'Snap: ON';
  if (snapState) snapState.textContent = '10 px';
  scheduleSave();
});

document.addEventListener('keydown', (event) => {
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.selected) {
    if (state.selected.type === 'plant') {
      state.plants = state.plants.filter((item) => item.id !== state.selected?.id);
    } else {
      state.beds = state.beds.filter((item) => item.id !== state.selected?.id);
    }
    state.selected = null;
    syncScene();
    scheduleSave();
  }

  if ((event.ctrlKey || event.metaKey) && event.key === '=') {
    event.preventDefault();
    setZoom(state.zoom + 0.1);
  }
  if ((event.ctrlKey || event.metaKey) && event.key === '-') {
    event.preventDefault();
    setZoom(state.zoom - 0.1);
  }
});

if (snapButton) snapButton.textContent = `Snap: ${state.snap ? 'ON' : 'OFF'}`;
if (snapState) snapState.textContent = state.snap ? '10 px' : 'wyłączony';
syncScene();
applyZoom();
