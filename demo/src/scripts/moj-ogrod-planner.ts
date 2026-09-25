type PlantState = {
  id: string;
  name: string;
  short: string;
  x: number;
  y: number;
};

type PlannerState = {
  zoom: number;
  plants: PlantState[];
  selectedId: string | null;
};

const STORAGE_KEY = 'moj-ogrod-planner-v1';

const initialPlants: PlantState[] = [
  { id: 'p1', name: 'Hortensja bukietowa', short: 'H', x: 22, y: 25 },
  { id: 'p2', name: 'Sosna bośniacka', short: 'S', x: 33, y: 29 },
  { id: 'p3', name: 'Paproć', short: 'P', x: 75, y: 29 },
  { id: 'p4', name: 'Hakonechloa', short: 'Ha', x: 81, y: 38 },
  { id: 'p5', name: 'Żurawka', short: 'Ż', x: 36, y: 80 },
  { id: 'p6', name: 'Funkia', short: 'F', x: 50, y: 79 },
];

const defaultState: PlannerState = {
  zoom: 1,
  plants: initialPlants,
  selectedId: 'p1',
};

const loadState = (): PlannerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw) as PlannerState;
    return {
      zoom: Math.min(1.8, Math.max(0.6, parsed.zoom || 1)),
      plants: Array.isArray(parsed.plants) && parsed.plants.length ? parsed.plants : initialPlants,
      selectedId: parsed.selectedId ?? null,
    };
  } catch {
    return structuredClone(defaultState);
  }
};

const state = loadState();

const canvas = document.querySelector<HTMLElement>('[data-planner-canvas]');
const scene = document.querySelector<HTMLElement>('[data-planner-scene]');
const zoomLabel = document.querySelector<HTMLElement>('[data-zoom-label]');
const saveBadge = document.querySelector<HTMLElement>('[data-save-badge]');
const inspectorTitle = document.querySelector<HTMLElement>('[data-inspector-title]');
const inspectorType = document.querySelector<HTMLElement>('[data-inspector-type]');

if (!canvas || !scene || !zoomLabel || !saveBadge) {
  throw new Error('Planner UI is incomplete.');
}

let dragging: {
  id: string;
  offsetX: number;
  offsetY: number;
} | null = null;

let saveTimer = 0;

const scheduleSave = () => {
  saveBadge.textContent = 'zapisywanie…';
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveBadge.textContent = 'zapisano';
  }, 250);
};

const applyZoom = () => {
  scene.style.transform = `scale(${state.zoom})`;
  zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
};

const renderSelection = () => {
  document.querySelectorAll<HTMLElement>('[data-plant-id]').forEach((el) => {
    el.classList.toggle('selected', el.dataset.plantId === state.selectedId);
  });

  const plant = state.plants.find((item) => item.id === state.selectedId);
  if (inspectorTitle) inspectorTitle.textContent = plant?.name ?? 'Plan ogrodu';
  if (inspectorType) inspectorType.textContent = plant ? 'roślina' : 'projekt';
};

const setPlantPosition = (el: HTMLElement, plant: PlantState) => {
  el.style.left = `${plant.x}%`;
  el.style.top = `${plant.y}%`;
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

const syncPlants = () => {
  document.querySelectorAll('[data-plant-id]').forEach((el) => el.remove());
  state.plants.forEach(createPlantElement);
  renderSelection();
};

const selectPlant = (id: string | null) => {
  state.selectedId = id;
  renderSelection();
  scheduleSave();
};

scene.addEventListener('pointerdown', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-plant-id]');
  if (!target) {
    if ((event.target as HTMLElement).closest('[data-bed]')) {
      selectPlant(null);
    }
    return;
  }

  const id = target.dataset.plantId;
  if (!id) return;

  const rect = target.getBoundingClientRect();
  dragging = {
    id,
    offsetX: event.clientX - rect.left - rect.width / 2,
    offsetY: event.clientY - rect.top - rect.height / 2,
  };

  target.setPointerCapture(event.pointerId);
  target.classList.add('dragging');
  selectPlant(id);
});

scene.addEventListener('pointermove', (event) => {
  if (!dragging) return;

  const plant = state.plants.find((item) => item.id === dragging?.id);
  const target = scene.querySelector<HTMLElement>(`[data-plant-id="${dragging.id}"]`);
  if (!plant || !target) return;

  const rect = scene.getBoundingClientRect();
  const x = ((event.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
  const y = ((event.clientY - rect.top - dragging.offsetY) / rect.height) * 100;

  plant.x = Math.max(2, Math.min(96, x));
  plant.y = Math.max(3, Math.min(94, y));
  setPlantPosition(target, plant);
  scheduleSave();
});

const stopDrag = () => {
  if (!dragging) return;
  const target = scene.querySelector<HTMLElement>(`[data-plant-id="${dragging.id}"]`);
  target?.classList.remove('dragging');
  dragging = null;
};

scene.addEventListener('pointerup', stopDrag);
scene.addEventListener('pointercancel', stopDrag);

const setZoom = (next: number) => {
  state.zoom = Math.max(0.6, Math.min(1.8, next));
  applyZoom();
  scheduleSave();
};

document.querySelector('[data-zoom-in]')?.addEventListener('click', () => setZoom(state.zoom + 0.1));
document.querySelector('[data-zoom-out]')?.addEventListener('click', () => setZoom(state.zoom - 0.1));
document.querySelector('[data-zoom-reset]')?.addEventListener('click', () => setZoom(1));
document.querySelector('[data-fit]')?.addEventListener('click', () => setZoom(0.9));

document.querySelector('[data-add-plant]')?.addEventListener('click', () => {
  const nextNo = state.plants.length + 1;
  const plant: PlantState = {
    id: `p${Date.now()}`,
    name: `Nowa roślina ${nextNo}`,
    short: '+',
    x: 50,
    y: 50,
  };
  state.plants.push(plant);
  state.selectedId = plant.id;
  createPlantElement(plant);
  renderSelection();
  scheduleSave();
});

document.querySelector('[data-auto-layout]')?.addEventListener('click', () => {
  const cols = Math.ceil(Math.sqrt(state.plants.length));
  state.plants.forEach((plant, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    plant.x = 22 + col * 15;
    plant.y = 24 + row * 16;
    const el = scene.querySelector<HTMLElement>(`[data-plant-id="${plant.id}"]`);
    if (el) setPlantPosition(el, plant);
  });
  scheduleSave();
});

document.querySelector('[data-reset-project]')?.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state.zoom = 1;
  state.plants = structuredClone(initialPlants);
  state.selectedId = 'p1';
  syncPlants();
  applyZoom();
  scheduleSave();
});

document.addEventListener('keydown', (event) => {
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedId) {
    const index = state.plants.findIndex((plant) => plant.id === state.selectedId);
    if (index >= 0) {
      state.plants.splice(index, 1);
      state.selectedId = null;
      syncPlants();
      scheduleSave();
    }
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

syncPlants();
applyZoom();
