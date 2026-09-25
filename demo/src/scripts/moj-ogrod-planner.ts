type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type Sun = 'sun' | 'partial' | 'shade';
type Moisture = 'dry' | 'normal' | 'moist';
type SoilPh = 'acid' | 'neutral' | 'alkaline';
type FrontEdge = 'top' | 'bottom' | 'left' | 'right';
type PlantStatus = 'planted' | 'planned';

type PlantState = {
  id: string;
  name: string;
  latin?: string;
  short: string;
  x: number;
  y: number;
  spacing: number;
  height: number;
  spread: number;
  bloomMonths: number[];
  evergreen: boolean;
  seasons: Season[];
  sun: Sun[];
  moisture: Moisture[];
  ph: SoilPh[];
  soil: string;
  status: PlantStatus;
};

type BedState = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sun: Sun;
  moisture: Moisture;
  ph: SoilPh;
  frontEdge: FrontEdge;
};

type Selection = { type: 'plant' | 'bed'; id: string } | null;

type PlannerState = {
  zoom: number;
  snap: boolean;
  growthYear: number;
  currentMonth: number;
  showPlanted: boolean;
  showPlanned: boolean;
  plants: PlantState[];
  beds: BedState[];
  selected: Selection;
};

type FitResult = {
  score: number;
  issues: string[];
};

const STORAGE_KEY = 'moj-ogrod-planner-v6';
const LEGACY_STORAGE_KEYS = ['moj-ogrod-planner-v5','moj-ogrod-planner-v4','moj-ogrod-planner-v3'];
const BUDGET_STORAGE_KEY = 'moj-ogrod-budget-prices-v1';
const SNAP_STEP = 2;
const HISTORY_LIMIT = 40;

const sunLabels: Record<Sun,string> = {
  sun:'pełne słońce',
  partial:'półcień',
  shade:'cień',
};

const moistureLabels: Record<Moisture,string> = {
  dry:'sucha',
  normal:'umiarkowana',
  moist:'wilgotna',
};

const phLabels: Record<SoilPh,string> = {
  acid:'kwaśny',
  neutral:'obojętny',
  alkaline:'zasadowy',
};

const seasonLabels: Record<Season,string> = {
  spring:'wiosna',
  summer:'lato',
  autumn:'jesień',
  winter:'zima',
};

const catalog: Array<Omit<PlantState,'id'|'x'|'y'|'status'>> = [
  { name:'Hortensja bukietowa', latin:'Hydrangea paniculata', short:'H', spacing:90, height:180, spread:180, bloomMonths:[7,8,9,10], evergreen:false, seasons:['summer','autumn'], sun:['sun','partial'], moisture:['normal','moist'], ph:['acid','neutral','alkaline'], soil:'żyzna, próchniczna i przepuszczalna' },
  { name:'Sosna bośniacka Compact Gem', latin:"Pinus heldreichii 'Compact Gem'", short:'S', spacing:120, height:250, spread:200, bloomMonths:[], evergreen:true, seasons:['spring','summer','autumn','winter'], sun:['sun'], moisture:['dry','normal'], ph:['acid','neutral','alkaline'], soil:'przepuszczalna; bez zastoin wody' },
  { name:'Paproć ogrodowa', latin:'Dryopteris', short:'P', spacing:55, height:90, spread:75, bloomMonths:[], evergreen:false, seasons:['spring','summer','autumn'], sun:['shade','partial'], moisture:['moist'], ph:['acid','neutral','alkaline'], soil:'próchniczna, stale lekko wilgotna' },
  { name:'Hakonechloa smukła', latin:'Hakonechloa macra', short:'Ha', spacing:50, height:45, spread:50, bloomMonths:[7,8], evergreen:false, seasons:['summer','autumn','winter'], sun:['sun','partial','shade'], moisture:['moist'], ph:['acid','neutral','alkaline'], soil:'próchniczna, żyzna i wilgotna' },
  { name:'Żurawka', latin:'Heuchera', short:'Ż', spacing:35, height:35, spread:45, bloomMonths:[5,6,7], evergreen:true, seasons:['spring','summer','autumn','winter'], sun:['partial','shade'], moisture:['normal','moist'], ph:['acid','neutral'], soil:'próchniczna i przepuszczalna' },
  { name:'Funkia', latin:'Hosta', short:'F', spacing:60, height:60, spread:75, bloomMonths:[7,8,9], evergreen:false, seasons:['spring','summer','autumn'], sun:['partial','shade'], moisture:['moist'], ph:['acid','neutral','alkaline'], soil:'żyzna, próchniczna i wilgotna' },
  { name:'Rozplenica japońska', latin:'Pennisetum alopecuroides', short:'R', spacing:70, height:90, spread:120, bloomMonths:[8,9,10], evergreen:false, seasons:['summer','autumn','winter'], sun:['sun'], moisture:['dry','normal'], ph:['neutral','alkaline'], soil:'przepuszczalna, umiarkowanie żyzna' },
  { name:'Tawułka Arendsa', latin:'Astilbe × arendsii', short:'T', spacing:45, height:75, spread:60, bloomMonths:[7,8,9,10], evergreen:false, seasons:['summer'], sun:['partial','shade'], moisture:['moist'], ph:['acid','neutral'], soil:'żyzna, próchniczna i wilgotna' },
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const catalogByName = new Map(catalog.map(plant => [plant.name, plant]));

const initialPlants: PlantState[] = [
  { id:'p1', ...clone(catalog[0]), x:22, y:25, status:'planted' },
  { id:'p2', ...clone(catalog[1]), x:34, y:30, status:'planted' },
  { id:'p3', ...clone(catalog[2]), x:72, y:29, status:'planted' },
  { id:'p4', ...clone(catalog[3]), x:80, y:39, status:'planned' },
  { id:'p5', ...clone(catalog[4]), x:38, y:75, status:'planned' },
  { id:'p6', ...clone(catalog[5]), x:53, y:76, status:'planned' },
];

const initialBeds: BedState[] = [
  { id:'b1', name:'Rabata frontowa', x:15, y:18, width:31, height:24, sun:'sun', moisture:'normal', ph:'neutral', frontEdge:'bottom' },
  { id:'b2', name:'Rabata cienista', x:61, y:20, width:26, height:31, sun:'shade', moisture:'moist', ph:'neutral', frontEdge:'bottom' },
  { id:'b3', name:'Rabata przy tarasie', x:24, y:65, width:44, height:20, sun:'partial', moisture:'moist', ph:'neutral', frontEdge:'bottom' },
];

const defaultState: PlannerState = {
  zoom:1,
  snap:true,
  growthYear:3,
  currentMonth:0,
  showPlanted:true,
  showPlanned:true,
  plants:clone(initialPlants),
  beds:clone(initialBeds),
  selected:{ type:'plant', id:'p1' },
};

const normalisePlant = (input: Partial<PlantState> & { name?: string }, index = 0): PlantState => {
  const fallback = catalogByName.get(input.name || '') || catalog[0];
  return {
    id: input.id || `p-import-${Date.now()}-${index}`,
    name: input.name || fallback.name,
    latin: input.latin || fallback.latin,
    short: input.short || fallback.short,
    x: Number.isFinite(Number(input.x)) ? Number(input.x) : 50,
    y: Number.isFinite(Number(input.y)) ? Number(input.y) : 50,
    spacing: Number.isFinite(Number(input.spacing)) ? Number(input.spacing) : fallback.spacing,
    height: Number.isFinite(Number(input.height)) ? Number(input.height) : fallback.height,
    spread: Number.isFinite(Number(input.spread)) ? Number(input.spread) : fallback.spread,
    bloomMonths: Array.isArray(input.bloomMonths) ? input.bloomMonths.map(Number).filter(month=>month>=1&&month<=12) : clone(fallback.bloomMonths),
    evergreen: typeof input.evergreen === 'boolean' ? input.evergreen : fallback.evergreen,
    seasons: Array.isArray(input.seasons) && input.seasons.length ? input.seasons as Season[] : clone(fallback.seasons),
    sun: Array.isArray(input.sun) && input.sun.length ? input.sun as Sun[] : clone(fallback.sun),
    moisture: Array.isArray(input.moisture) && input.moisture.length ? input.moisture as Moisture[] : clone(fallback.moisture),
    ph: Array.isArray(input.ph) && input.ph.length ? input.ph as SoilPh[] : clone(fallback.ph),
    soil: input.soil || fallback.soil,
    status: input.status === 'planted' || input.status === 'planned'
      ? input.status
      : index < 3 ? 'planted' : 'planned',
  };
};

const normaliseBed = (input: Partial<BedState>, index = 0): BedState => ({
  id: input.id || `b-import-${Date.now()}-${index}`,
  name: input.name || `Rabata ${index+1}`,
  x: Number.isFinite(Number(input.x)) ? Number(input.x) : 30,
  y: Number.isFinite(Number(input.y)) ? Number(input.y) : 30,
  width: Number.isFinite(Number(input.width)) ? Number(input.width) : 24,
  height: Number.isFinite(Number(input.height)) ? Number(input.height) : 18,
  sun: input.sun || 'partial',
  moisture: input.moisture || 'normal',
  ph: input.ph || 'neutral',
  frontEdge: input.frontEdge || 'bottom',
});

const loadState = (): PlannerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(key=>localStorage.getItem(key)).find(Boolean);
    if (!raw) return clone(defaultState);
    const parsed = JSON.parse(raw) as Partial<PlannerState>;
    return {
      zoom: clamp(Number(parsed.zoom) || 1, .6, 1.8),
      snap: parsed.snap ?? true,
      growthYear: clamp(Number(parsed.growthYear) || 3, 1, 5),
      currentMonth: clamp(Number(parsed.currentMonth) || 0, 0, 12),
      showPlanted: parsed.showPlanted ?? true,
      showPlanned: parsed.showPlanned ?? true,
      plants: Array.isArray(parsed.plants) ? parsed.plants.map((p,i)=>normalisePlant(p,i)) : clone(initialPlants),
      beds: Array.isArray(parsed.beds) ? parsed.beds.map((b,i)=>normaliseBed(b,i)) : clone(initialBeds),
      selected: parsed.selected ?? null,
    };
  } catch {
    return clone(defaultState);
  }
};

const state = loadState();

const loadBudgetPrices = ():Record<string,number> => {
  try {
    const raw=localStorage.getItem(BUDGET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const budgetPrices=loadBudgetPrices();
const saveBudgetPrices=()=>localStorage.setItem(BUDGET_STORAGE_KEY,JSON.stringify(budgetPrices));
const formatMoney=new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'});

const scene = document.querySelector<HTMLElement>('[data-planner-scene]');
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const qa = <T extends Element = HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
if (!scene) throw new Error('Planner scene missing.');

let saveTimer = 0;
let interaction:
  | { type:'plant'; id:string; offsetX:number; offsetY:number; startX:number; startY:number; members:Array<{id:string;x:number;y:number}> }
  | { type:'bed'; id:string; offsetX:number; offsetY:number; startBedX:number; startBedY:number; members:Array<{id:string;x:number;y:number}> }
  | { type:'resize'; id:string; startX:number; startY:number; startW:number; startH:number }
  | null = null;

const undoStack: string[] = [];
const redoStack: string[] = [];
const multiSelectedIds = new Set<string>();
let paintMode = false;
let paintStroke = false;
let paintSourceId: string | null = null;
let lastPaintPoint: {x:number;y:number} | null = null;
let paintSequence = 0;

const snap = (v:number) => state.snap ? Math.round(v / SNAP_STEP) * SNAP_STEP : v;
const growthFactors = [0,.35,.55,.72,.86,1];
const growthFactor = () => growthFactors[clamp(state.growthYear,1,5)];
const effectiveSpread = (plant:PlantState) => plant.spread * growthFactor();
const effectiveHeight = (plant:PlantState) => plant.height * growthFactor();

const plantBackness = (plant:Pick<PlantState,'x'|'y'>, bed:BedState) => {
  const relX=clamp((plant.x-bed.x)/Math.max(1,bed.width),0,1);
  const relY=clamp((plant.y-bed.y)/Math.max(1,bed.height),0,1);
  if (bed.frontEdge==='bottom') return 1-relY;
  if (bed.frontEdge==='top') return relY;
  if (bed.frontEdge==='left') return relX;
  return 1-relX;
};

const layeringScore = (bed:BedState) => {
  const plants=plantsInBed(bed);
  if (plants.length < 2) return 100;
  let comparable=0;
  let correct=0;
  for (let i=0;i<plants.length;i++) {
    for (let j=i+1;j<plants.length;j++) {
      const a=plants[i], b=plants[j];
      const heightDiff=effectiveHeight(a)-effectiveHeight(b);
      const depthDiff=plantBackness(a,bed)-plantBackness(b,bed);
      if (Math.abs(heightDiff)<5 || Math.abs(depthDiff)<.04) continue;
      comparable++;
      if (heightDiff*depthDiff>0) correct++;
    }
  }
  return comparable ? Math.round(correct/comparable*100) : 100;
};

const repetitionSummary = (bed:BedState) => {
  const counts=new Map<string,number>();
  plantsInBed(bed).forEach(p=>counts.set(p.name,(counts.get(p.name)||0)+1));
  const groups=[...counts.values()].filter(count=>count>=2);
  const repeated=groups.reduce((sum,count)=>sum+count,0);
  return {groups:groups.length,repeated};
};

const bloomContinuity = (bed:BedState) => {
  const months=new Set<number>();
  plantsInBed(bed).forEach(p=>p.bloomMonths.forEach(month=>months.add(month)));
  const core=[3,4,5,6,7,8,9,10];
  return {
    active:core.filter(month=>months.has(month)).length,
    months,
  };
};

const scheduleSave = () => {
  const badge = q('[data-save-badge]');
  if (badge) badge.textContent = 'zapisywanie…';
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (badge) badge.textContent = 'zapisano';
  }, 180);
};

const modelSnapshot = () => JSON.stringify({
  plants:state.plants,
  beds:state.beds,
  selected:state.selected,
});

const updateHistoryButtons = () => {
  const undo = q<HTMLButtonElement>('[data-undo]');
  const redo = q<HTMLButtonElement>('[data-redo]');
  if (undo) undo.disabled = undoStack.length === 0;
  if (redo) redo.disabled = redoStack.length === 0;
};

const pushHistory = () => {
  const current = modelSnapshot();
  if (undoStack[undoStack.length-1] !== current) {
    undoStack.push(current);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }
  redoStack.length = 0;
  updateHistoryButtons();
};

const restoreModel = (raw:string) => {
  const parsed = JSON.parse(raw) as Pick<PlannerState,'plants'|'beds'|'selected'>;
  state.plants = parsed.plants.map((p,i)=>normalisePlant(p,i));
  state.beds = parsed.beds.map((b,i)=>normaliseBed(b,i));
  state.selected = parsed.selected ?? null;
  syncScene();
  scheduleSave();
};

const undo = () => {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(modelSnapshot());
  restoreModel(previous);
  updateHistoryButtons();
};

const redo = () => {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(modelSnapshot());
  restoreModel(next);
  updateHistoryButtons();
};

const getBedForPlant = (plant: PlantState) =>
  state.beds.find(bed =>
    plant.x >= bed.x &&
    plant.x <= bed.x + bed.width &&
    plant.y >= bed.y &&
    plant.y <= bed.y + bed.height
  );

const plantsInBed = (bed: BedState) => state.plants.filter(p => getBedForPlant(p)?.id === bed.id);

const getContextBed = () => {
  if (state.selected?.type === 'bed') return state.beds.find(b => b.id === state.selected?.id);
  if (state.selected?.type === 'plant') {
    const plant = state.plants.find(p => p.id === state.selected?.id);
    return plant ? getBedForPlant(plant) : undefined;
  }
  return undefined;
};

const fitPlantToBed = (plant: Pick<PlantState,'sun'|'moisture'|'ph'>, bed: BedState): FitResult => {
  const issues:string[] = [];
  if (!plant.sun.includes(bed.sun)) issues.push(`światło: ${sunLabels[bed.sun]}`);
  if (!plant.moisture.includes(bed.moisture)) issues.push(`wilgotność: ${moistureLabels[bed.moisture]}`);
  if (!plant.ph.includes(bed.ph)) issues.push(`odczyn: ${phLabels[bed.ph]}`);
  return {
    score: Math.round(((3 - issues.length) / 3) * 100),
    issues,
  };
};

const bedFitPercent = (bed:BedState) => {
  const plants = plantsInBed(bed);
  if (!plants.length) return 100;
  return Math.round(plants.reduce((sum,p)=>sum+fitPlantToBed(p,bed).score,0)/plants.length);
};

const getCollisionIds = () => {
  const ids = new Set<string>();
  for (let i=0; i<state.plants.length; i++) {
    for (let j=i+1; j<state.plants.length; j++) {
      const a = state.plants[i], b = state.plants[j];
      const dist = Math.hypot(a.x-b.x, a.y-b.y);
      const required = Math.max(3.5, ((effectiveSpread(a)+effectiveSpread(b))/2)/18);
      if (dist < required) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
};

const coverageForBed = (bed: BedState) => {
  const plants = plantsInBed(bed);
  if (!plants.length) return 0;
  const occupied = plants.reduce((sum,p) => sum + Math.PI * Math.pow(Math.max(1.35, effectiveSpread(p) / 65), 2), 0);
  const bedArea = Math.max(1, bed.width * bed.height);
  return Math.round(clamp((occupied / bedArea) * 100, 0, 100));
};

const seasonPercent = (plants: PlantState[], season: Season) => {
  if (!plants.length) return 0;
  return Math.round((plants.filter(p => p.seasons.includes(season)).length / plants.length) * 100);
};

const setPlantPosition = (el:HTMLElement,p:PlantState) => {
  el.style.left = `${p.x}%`;
  el.style.top = `${p.y}%`;
  el.style.setProperty('--spacing-halo', `${Math.round(clamp(effectiveSpread(p)*.68,44,190))}px`);
  el.style.setProperty('--plant-size', `${Math.round(clamp(28 + effectiveSpread(p)*.12,30,58))}px`);
};

const setBedGeometry = (el:HTMLElement,b:BedState) => {
  el.style.left = `${b.x}%`;
  el.style.top = `${b.y}%`;
  el.style.width = `${b.width}%`;
  el.style.height = `${b.height}%`;
};

const createPlantElement = (p:PlantState) => {
  const el = document.createElement('button');
  el.className = 'plant-dot';
  el.dataset.plantId = p.id;
  el.title = p.name;
  el.textContent = p.short;
  setPlantPosition(el,p);
  scene.appendChild(el);
};

const createBedElement = (b:BedState) => {
  const el = document.createElement('button');
  el.className = 'bed';
  el.dataset.bedId = b.id;
  el.innerHTML = `<span class="bed-label">${b.name}</span><span class="bed-condition" data-bed-condition="${b.id}"></span><span class="bed-stats" data-bed-stats="${b.id}"></span><span class="resize-handle" data-resize-bed="${b.id}"></span>`;
  setBedGeometry(el,b);
  scene.appendChild(el);
};

const templateFromLibraryItem = (item:HTMLElement): Omit<PlantState,'id'|'x'|'y'|'status'> => ({
  name:item.dataset.libraryName || 'Roślina',
  latin:item.dataset.libraryLatin,
  short:item.dataset.libraryShort || 'R',
  spacing:Number(item.dataset.librarySpacing || 50),
  height:Number(item.dataset.libraryHeight || 60),
  spread:Number(item.dataset.librarySpread || item.dataset.librarySpacing || 60),
  bloomMonths:(item.dataset.libraryBloom || '').split(',').map(Number).filter(month=>month>=1&&month<=12),
  evergreen:item.dataset.libraryEvergreen === 'true',
  seasons:(item.dataset.librarySeasons || 'summer').split(',') as Season[],
  sun:(item.dataset.librarySun || 'sun,partial,shade').split(',') as Sun[],
  moisture:(item.dataset.libraryMoisture || 'dry,normal,moist').split(',') as Moisture[],
  ph:(item.dataset.libraryPh || 'acid,neutral,alkaline').split(',') as SoilPh[],
  soil:item.dataset.librarySoil || 'do uzupełnienia',
});

const candidatePosition = (bed:BedState, targetSpread:number, excludeId?:string) => {
  const candidates = [
    [.5,.5],[.32,.34],[.68,.34],[.32,.68],[.68,.68],
    [.5,.28],[.5,.72],[.24,.5],[.76,.5],
  ];
  const inThisBed = plantsInBed(bed).filter(p=>p.id!==excludeId);

  for (const [rx,ry] of candidates) {
    const x = snap(bed.x + bed.width * rx);
    const y = snap(bed.y + bed.height * ry);
    const clear = inThisBed.every(p => {
      const required = Math.max(3.5, ((targetSpread+effectiveSpread(p))/2)/18);
      return Math.hypot(x-p.x,y-p.y) >= required;
    });
    if (clear) return {x,y};
  }

  const offset = Math.min(8, inThisBed.length*1.6);
  return {
    x:snap(clamp(bed.x + bed.width/2 + offset, bed.x+2, bed.x+bed.width-2)),
    y:snap(clamp(bed.y + bed.height/2 + offset/2, bed.y+2, bed.y+bed.height-2)),
  };
};

const bestBedForPlant = (plant:PlantState) => [...state.beds]
  .sort((a,b)=>{
    const fitDiff=fitPlantToBed(plant,b).score-fitPlantToBed(plant,a).score;
    if (fitDiff) return fitDiff;
    return coverageForBed(a)-coverageForBed(b);
  })[0];

const addPlantFromTemplate = (template:Omit<PlantState,'id'|'x'|'y'|'status'>) => {
  pushHistory();
  const bed = getContextBed();
  const position = bed ? candidatePosition(bed,template.spread*growthFactor()) : {x:50,y:50};
  const plant:PlantState = {
    id:`p${Date.now()}`,
    ...clone(template),
    ...position,
    status:'planned',
  };
  state.plants.push(plant);
  state.selected = {type:'plant',id:plant.id};
  createPlantElement(plant);
  renderSelection();
  scheduleSave();
};

const updateLibrary = () => {
  const search = (q<HTMLInputElement>('[data-library-search]')?.value || '').trim().toLowerCase();
  const compatibleOnly = q<HTMLInputElement>('[data-compatible-filter]')?.checked || false;
  const bed = getContextBed();
  const filter = q<HTMLInputElement>('[data-compatible-filter]');
  const label = q('[data-compatible-filter-label]');
  let visible = 0;

  if (filter) filter.disabled = !bed;
  if (label) label.textContent = bed ? `Pasujące do: ${bed.name}` : 'Wybierz rabatę, aby filtrować';

  qa<HTMLElement>('[data-library-item]').forEach(item => {
    const template = templateFromLibraryItem(item);
    const hay = `${template.name} ${template.latin || ''}`.toLowerCase();
    const searchMatch = !search || hay.includes(search);
    const fit = bed ? fitPlantToBed(template,bed) : null;
    const fitEl = item.querySelector<HTMLElement>('[data-library-fit]');
    if (fitEl) fitEl.textContent = fit ? `${fit.score}%` : '—';
    item.classList.toggle('library-mismatch', Boolean(fit && fit.score < 100));
    const compatibilityMatch = !compatibleOnly || !bed || fit?.score === 100;
    item.hidden = !(searchMatch && compatibilityMatch);
    if (!item.hidden) visible++;
  });

  const total = qa('[data-library-item]').length;
  const counter = q('[data-compatible-filter-count]');
  if (counter) counter.textContent = `${visible}/${total}`;
};

const renderAnalysis = () => {
  const collisions = getCollisionIds();
  const mismatchIds = new Set<string>();
  let outside = 0;

  state.plants.forEach(p => {
    const el = scene.querySelector<HTMLElement>(`[data-plant-id="${p.id}"]`);
    if (!el) return;
    const bed = getBedForPlant(p);
    const mismatch = bed ? fitPlantToBed(p,bed).score < 100 : false;
    el.classList.toggle('collision', collisions.has(p.id));
    el.classList.toggle('outside-bed', !bed);
    el.classList.toggle('site-mismatch', mismatch);
    const blooming=state.currentMonth>0 && p.bloomMonths.includes(state.currentMonth);
    el.classList.toggle('blooming', blooming);
    el.classList.toggle('season-muted', state.currentMonth>0 && !blooming && !p.evergreen);
    el.classList.toggle('plant-planted',p.status==='planted');
    el.classList.toggle('plant-planned',p.status==='planned');
    el.classList.toggle('layer-hidden',
      (p.status==='planted' && !state.showPlanted) ||
      (p.status==='planned' && !state.showPlanned)
    );
    setPlantPosition(el,p);
    el.dataset.bedName = bed?.name || '';
    if (!bed) outside++;
    if (mismatch) mismatchIds.add(p.id);
  });

  state.beds.forEach(b => {
    const stat = scene.querySelector<HTMLElement>(`[data-bed-stats="${b.id}"]`);
    const condition = scene.querySelector<HTMLElement>(`[data-bed-condition="${b.id}"]`);
    if (stat) stat.textContent = `${plantsInBed(b).length} roślin · ${coverageForBed(b)}% · fit ${bedFitPercent(b)}%`;
    if (condition) condition.textContent = `${sunLabels[b.sun]} · ${moistureLabels[b.moisture]} · front: ${b.frontEdge}`;
  });

  const avgCoverage = state.beds.length
    ? Math.round(state.beds.reduce((sum,b) => sum + coverageForBed(b), 0) / state.beds.length)
    : 0;

  const collisionCount = collisions.size;
  const mismatchCount = mismatchIds.size;
  const avgLayering = state.beds.length
    ? Math.round(state.beds.reduce((sum,bed)=>sum+layeringScore(bed),0)/state.beds.length)
    : 100;
  const score = clamp(
    100 - collisionCount*6 - outside*8 - mismatchCount*7 - Math.max(0, 30-avgCoverage)/2 - Math.max(0,65-avgLayering)/4,
    25,
    100,
  );

  q('[data-kpi-beds]')!.textContent = String(state.beds.length);
  q('[data-kpi-plants]')!.textContent = String(state.plants.length);
  q('[data-kpi-collisions]')!.textContent = String(collisionCount);
  q('[data-kpi-mismatch]')!.textContent = String(mismatchCount);
  q('[data-kpi-coverage]')!.textContent = `${avgCoverage}%`;
  q('[data-outside-count]')!.textContent = String(outside);
  q('[data-mismatch-count]')!.textContent = String(mismatchCount);
  const plantedCount=state.plants.filter(p=>p.status==='planted').length;
  const plannedCount=state.plants.filter(p=>p.status==='planned').length;
  const plantedLayer=q('[data-layer-planted-state]');
  const plannedLayer=q('[data-layer-planned-state]');
  if (plantedLayer) plantedLayer.textContent=state.showPlanted ? `✓ ${plantedCount}` : `— ${plantedCount}`;
  if (plannedLayer) plannedLayer.textContent=state.showPlanned ? `✓ ${plannedCount}` : `— ${plannedCount}`;
  q('[data-analysis-score]')!.textContent = `${Math.round(score)}%`;
  (q('[data-analysis-progress]') as HTMLElement).style.width = `${score}%`;

  const problemCount = collisionCount + outside + mismatchCount;
  q('[data-collision-badge]')!.textContent = `${problemCount} problemów`;

  q('[data-collision-note]')!.textContent = outside
    ? 'Najpierw przenieś rośliny znajdujące się poza rabatami.'
    : mismatchCount
      ? 'Część roślin nie pasuje do światła, wilgotności lub odczynu wybranej rabaty.'
      : collisionCount
        ? 'Skoryguj rozstaw roślin oznaczonych czerwonym obrysem.'
        : 'Układ nie zawiera wykrytych konfliktów.';

  q('[data-analysis-copy]')!.textContent =
    `Pokrycie: ${avgCoverage}%. Warstwowanie: ${avgLayering}%. Stanowisko: ${mismatchCount} niedopasowanych. Poza rabatami: ${outside}. W kolizji: ${collisionCount}.`;
};


const escapeHtml=(value:string)=>value
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;');

const soilLitersForPlant=(plant:PlantState)=>{
  if (plant.spread>=150) return 40;
  if (plant.spread>=80) return 25;
  return 15;
};

const fertilizerForPlant=(plant:PlantState)=>{
  const name=plant.name.toLowerCase();
  if (name.includes('hortens')) return 'Nawóz do hortensji';
  if (name.includes('sosna') || plant.evergreen) return 'Nawóz do iglaków i zimozielonych';
  if (name.includes('hakone') || name.includes('rozplen')) return 'Nawóz do traw ozdobnych';
  return 'Nawóz organiczny do bylin';
};

type ShoppingRow = {
  section:'Rośliny'|'Podłoże'|'Nawożenie';
  name:string;
  quantity:number;
  unit:string;
  key:string;
  note?:string;
};

const buildShoppingRows=():ShoppingRow[]=>{
  const planned=state.plants.filter(plant=>plant.status==='planned');
  const plantGroups=new Map<string,number>();
  const soilGroups=new Map<string,number>();
  const fertilizerGroups=new Map<string,number>();

  planned.forEach(plant=>{
    plantGroups.set(plant.name,(plantGroups.get(plant.name)||0)+1);
    soilGroups.set(plant.soil,(soilGroups.get(plant.soil)||0)+soilLitersForPlant(plant));
    const fertilizer=fertilizerForPlant(plant);
    fertilizerGroups.set(fertilizer,(fertilizerGroups.get(fertilizer)||0)+1);
  });

  const rows:ShoppingRow[]=[];
  plantGroups.forEach((quantity,name)=>rows.push({
    section:'Rośliny',
    name,
    quantity,
    unit:'szt.',
    key:encodeURIComponent(`plant:${name}`),
  }));
  soilGroups.forEach((liters,name)=>rows.push({
    section:'Podłoże',
    name:`Podłoże: ${name}`,
    quantity:Math.max(1,Math.ceil(liters/20)),
    unit:'worek 20 L',
    key:encodeURIComponent(`soil:${name}`),
    note:`zapotrzebowanie ok. ${liters} L`,
  }));
  fertilizerGroups.forEach((plantCount,name)=>rows.push({
    section:'Nawożenie',
    name,
    quantity:Math.max(1,Math.ceil(plantCount/6)),
    unit:'opak.',
    key:encodeURIComponent(`fertilizer:${name}`),
    note:`dla ${plantCount} planowanych roślin`,
  }));
  return rows;
};

const renderShoppingView=()=>{
  const container=q<HTMLElement>('[data-shopping-list]');
  if (!container) return;
  const rows=buildShoppingRows();
  const plannedCount=state.plants.filter(plant=>plant.status==='planned').length;

  const bySection=new Map<string,ShoppingRow[]>();
  rows.forEach(row=>{
    const list=bySection.get(row.section)||[];
    list.push(row);
    bySection.set(row.section,list);
  });

  container.innerHTML=rows.length
    ? [...bySection.entries()].map(([section,items])=>`
      <section class="shopping-group">
        <div class="shopping-group-head">
          <h3>${escapeHtml(section)}</h3>
          <span>${items.length} pozycji</span>
        </div>
        ${items.map(row=>{
          const price=budgetPrices[row.key] ?? 0;
          const lineTotal=price*row.quantity;
          return `
            <div class="shopping-row">
              <div class="shopping-name">
                <strong>${escapeHtml(row.name)}</strong>
                ${row.note ? `<small>${escapeHtml(row.note)}</small>` : ''}
              </div>
              <div class="shopping-qty"><strong>${row.quantity}</strong><span>${escapeHtml(row.unit)}</span></div>
              <label class="shopping-price">
                <span>cena / jedn.</span>
                <input type="number" min="0" step="0.01" value="${price || ''}" placeholder="0,00" data-budget-key="${row.key}" />
              </label>
              <strong class="shopping-line-total">${formatMoney.format(lineTotal)}</strong>
            </div>`;
        }).join('')}
      </section>`
    ).join('')
    : '<div class="empty-state"><strong>Lista zakupów jest pusta.</strong><span>Wszystkie rośliny w projekcie są oznaczone jako posadzone.</span></div>';

  const total=rows.reduce((sum,row)=>sum+(budgetPrices[row.key]||0)*row.quantity,0);
  const lines=q('[data-shopping-lines]');
  const plants=q('[data-shopping-plants]');
  const totalEl=q('[data-shopping-total]');
  if (lines) lines.textContent=String(rows.length);
  if (plants) plants.textContent=String(plannedCount);
  if (totalEl) totalEl.textContent=formatMoney.format(total);

  qa<HTMLInputElement>('[data-budget-key]').forEach(input=>{
    input.addEventListener('input',()=>{
      const key=input.dataset.budgetKey;
      if (!key) return;
      budgetPrices[key]=Math.max(0,Number(input.value)||0);
      saveBudgetPrices();
      renderShoppingView();
    });
  });

  const nav=q('[data-nav-shopping-count]');
  if (nav) nav.textContent=String(plannedCount);
};

const renderGardenView=()=>{
  const summary=q<HTMLElement>('[data-garden-summary]');
  const list=q<HTMLElement>('[data-garden-list]');
  if (!summary || !list) return;
  const planted=state.plants.filter(p=>p.status==='planted').length;
  const planned=state.plants.length-planted;

  summary.innerHTML=`
    <div><span>Wszystkie</span><strong>${state.plants.length}</strong></div>
    <div><span>Posadzone</span><strong>${planted}</strong></div>
    <div><span>Planowane</span><strong>${planned}</strong></div>
    <div><span>Rabaty</span><strong>${state.beds.length}</strong></div>
  `;

  list.innerHTML=state.plants.length
    ? `
      <div class="garden-row garden-row-head">
        <span>Roślina</span><span>Rabata</span><span>Status</span><span>Stanowisko</span><span></span>
      </div>
      ${[...state.plants]
        .sort((a,b)=>a.status.localeCompare(b.status) || a.name.localeCompare(b.name,'pl'))
        .map(plant=>{
          const bed=getBedForPlant(plant);
          const fit=bed ? fitPlantToBed(plant,bed).score : null;
          return `
            <div class="garden-row">
              <div class="garden-plant"><span class="library-avatar">${escapeHtml(plant.short)}</span><div><strong>${escapeHtml(plant.name)}</strong><small>${escapeHtml(plant.latin||'')}</small></div></div>
              <span>${escapeHtml(bed?.name||'poza rabatą')}</span>
              <select data-garden-status="${plant.id}">
                <option value="planted" ${plant.status==='planted'?'selected':''}>posadzona</option>
                <option value="planned" ${plant.status==='planned'?'selected':''}>planowana</option>
              </select>
              <span class="fit-pill ${fit===100?'good':fit===null?'neutral':'warn'}">${fit===null?'—':fit+'%'}</span>
              <button class="ghost-btn compact" data-focus-plant="${plant.id}">↗</button>
            </div>`;
        }).join('')}
    `
    : '<div class="empty-state"><strong>Brak roślin w projekcie.</strong></div>';

  const nav=q('[data-nav-garden-count]');
  if (nav) nav.textContent=String(state.plants.length);
};

const bedIssues=(bed:BedState)=>{
  const issues:string[]=[];
  const plants=plantsInBed(bed);
  if (!plants.length) return ['rabata jest pusta'];
  if (coverageForBed(bed)<25) issues.push('niskie pokrycie');
  if (bedFitPercent(bed)<80) issues.push('dobór do stanowiska');
  if (layeringScore(bed)<65) issues.push('warstwowanie');
  if (bloomContinuity(bed).active<4 && plants.length>=3) issues.push('krótki sezon kwitnienia');
  if (!repetitionSummary(bed).groups && plants.length>=4) issues.push('brak rytmu');
  return issues;
};

const renderStudioView=()=>{
  const grid=q<HTMLElement>('[data-studio-grid]');
  if (!grid) return;
  grid.innerHTML=state.beds.map(bed=>{
    const plants=plantsInBed(bed);
    const issues=bedIssues(bed);
    return `
      <article class="studio-card">
        <div class="studio-card-head">
          <div><span>Rabata</span><h3>${escapeHtml(bed.name)}</h3></div>
          <span class="fit-pill ${issues.length?'warn':'good'}">${issues.length ? issues.length+' uwag' : 'OK'}</span>
        </div>
        <div class="studio-metrics">
          <div><span>Rośliny</span><strong>${plants.length}</strong></div>
          <div><span>Pokrycie</span><strong>${coverageForBed(bed)}%</strong></div>
          <div><span>Stanowisko</span><strong>${bedFitPercent(bed)}%</strong></div>
          <div><span>Warstwowanie</span><strong>${layeringScore(bed)}%</strong></div>
          <div><span>Kwitnienie III–X</span><strong>${bloomContinuity(bed).active}/8</strong></div>
        </div>
        <p>${issues.length ? escapeHtml(issues.join(' · ')) : 'Brak problemów wykrytych przez aktualne heurystyki.'}</p>
        <button class="ghost-btn" data-focus-bed="${bed.id}">Otwórz rabatę w planerze</button>
      </article>`;
  }).join('');
};

const renderProjectAnalysisView=()=>{
  const container=q<HTMLElement>('[data-project-analysis]');
  if (!container) return;
  const collisions=getCollisionIds();
  const outside=state.plants.filter(plant=>!getBedForPlant(plant));
  const mismatch=state.plants.filter(plant=>{
    const bed=getBedForPlant(plant);
    return bed ? fitPlantToBed(plant,bed).score<100 : false;
  });
  const planned=state.plants.filter(plant=>plant.status==='planned');
  const bedWarnings=state.beds.flatMap(bed=>bedIssues(bed).map(issue=>({bed,issue})));

  container.innerHTML=`
    <div class="analysis-kpis">
      <div><span>Rośliny</span><strong>${state.plants.length}</strong><small>${planned.length} planowanych</small></div>
      <div><span>Kolizje</span><strong>${collisions.size}</strong><small>przy roku ${state.growthYear}/5</small></div>
      <div><span>Stanowisko</span><strong>${mismatch.length}</strong><small>niedopasowanych</small></div>
      <div><span>Poza rabatą</span><strong>${outside.length}</strong><small>do przypisania</small></div>
    </div>
    <section class="analysis-list">
      <h3>Priorytety</h3>
      ${outside.map(plant=>`<div class="analysis-item danger"><strong>${escapeHtml(plant.name)}</strong><span>Roślina znajduje się poza rabatą.</span></div>`).join('')}
      ${mismatch.map(plant=>{
        const bed=getBedForPlant(plant)!;
        return `<div class="analysis-item warn"><strong>${escapeHtml(plant.name)}</strong><span>Nie pasuje w 100% do „${escapeHtml(bed.name)}”.</span></div>`;
      }).join('')}
      ${bedWarnings.map(({bed,issue})=>`<div class="analysis-item"><strong>${escapeHtml(bed.name)}</strong><span>${escapeHtml(issue)}</span></div>`).join('')}
      ${!outside.length&&!mismatch.length&&!bedWarnings.length ? '<div class="empty-state"><strong>Brak istotnych problemów.</strong><span>Projekt przechodzi aktualne reguły analizy.</span></div>' : ''}
    </section>
  `;
};

const renderMigrationViews=()=>{
  const gardenNav=q('[data-nav-garden-count]');
  const shoppingNav=q('[data-nav-shopping-count]');
  if (gardenNav) gardenNav.textContent=String(state.plants.length);
  if (shoppingNav) shoppingNav.textContent=String(state.plants.filter(plant=>plant.status==='planned').length);

  const active=qa<HTMLElement>('[data-workspace-view]').find(panel=>!panel.hidden)?.dataset.workspaceView;
  if (active==='garden') renderGardenView();
  if (active==='shopping') renderShoppingView();
  if (active==='studio') renderStudioView();
  if (active==='analysis') renderProjectAnalysisView();
};

const openWorkspaceView=(view:string, source?:HTMLElement)=>{
  qa<HTMLElement>('[data-workspace-view]').forEach(panel=>panel.hidden=panel.dataset.workspaceView!==view);
  qa<HTMLElement>('[data-open-view]').forEach(button=>button.classList.remove('active'));
  if (view==='planner') qa<HTMLElement>('[data-workspace-view]').forEach(panel=>panel.hidden=true);
  const activeButton=source || q<HTMLElement>(`[data-open-view="${view}"]`) || q<HTMLElement>('[data-open-view="planner"]');
  activeButton?.classList.add('active');
  renderMigrationViews();
};

const updateComposition = (bed?:BedState) => {
  const layering=q('[data-composition-layering]');
  const rhythm=q('[data-composition-rhythm]');
  const bloom=q('[data-composition-bloom]');
  const dominant=q('[data-composition-dominant]');
  const note=q('[data-composition-note]');

  qa<HTMLElement>('[data-bloom-month]').forEach(cell=>{
    const month=Number(cell.dataset.bloomMonth);
    const count=bed ? plantsInBed(bed).filter(p=>p.bloomMonths.includes(month)).length : 0;
    cell.classList.toggle('active', count>0);
    cell.classList.toggle('selected', state.currentMonth===month);
    const bar=cell.querySelector<HTMLElement>('i');
    if (bar) bar.style.setProperty('--bloom-count', String(Math.min(4,count)));
    cell.title=count ? `${count} roślin kwitnie` : 'brak kwitnienia';
  });

  if (!bed) {
    if (layering) layering.textContent='—';
    if (rhythm) rhythm.textContent='—';
    if (bloom) bloom.textContent='—';
    if (dominant) dominant.textContent='—';
    if (note) note.textContent='Wybierz rabatę, aby przeanalizować strukturę nasadzeń.';
    return;
  }

  const plants=plantsInBed(bed);
  const layerScore=layeringScore(bed);
  const repetition=repetitionSummary(bed);
  const continuity=bloomContinuity(bed);
  const focal=[...plants].sort((a,b)=>effectiveHeight(b)-effectiveHeight(a))[0];

  if (layering) layering.textContent=`${layerScore}%`;
  if (rhythm) rhythm.textContent=repetition.groups ? `${repetition.groups} grup · ${repetition.repeated} roślin` : 'brak powtórzeń';
  if (bloom) bloom.textContent=`${continuity.active}/8 mies. (III–X)`;
  if (dominant) dominant.textContent=focal ? `${focal.name} · ${Math.round(effectiveHeight(focal))} cm` : '—';

  if (note) {
    const hints:string[]=[];
    if (layerScore<65) hints.push('wysokie rośliny warto przesunąć głębiej względem frontu');
    if (!repetition.groups && plants.length>=4) hints.push('brakuje rytmu wynikającego z powtórzeń');
    if (continuity.active<4 && plants.length>=3) hints.push('kwitnienie jest skupione w krótkim okresie');
    note.textContent=hints.length ? hints.join(' · ') : 'Struktura rabaty jest czytelna w zastosowanych heurystykach.';
  }
};

const updateBedAnalytics = (bed?: BedState) => {
  if (!bed) {
    ['[data-bed-coverage]','[data-bed-fit]','[data-layer-low]','[data-layer-mid]','[data-layer-high]'].forEach(s => {
      const el=q(s); if (el) el.textContent='—';
    });
    (['spring','summer','autumn','winter'] as Season[]).forEach(s => {
      q(`[data-season-${s}-label]`)!.textContent='0%';
      (q(`[data-season-${s}]`) as HTMLElement).style.width='0%';
    });
    updateComposition();
    return;
  }

  const plants = plantsInBed(bed);
  q('[data-bed-coverage]')!.textContent = `${coverageForBed(bed)}%`;
  const fitEl = q('[data-bed-fit]');
  if (fitEl) fitEl.textContent = `${bedFitPercent(bed)}%`;
  q('[data-layer-low]')!.textContent = String(plants.filter(p=>p.height<50).length);
  q('[data-layer-mid]')!.textContent = String(plants.filter(p=>p.height>=50 && p.height<120).length);
  q('[data-layer-high]')!.textContent = String(plants.filter(p=>p.height>=120).length);

  (['spring','summer','autumn','winter'] as Season[]).forEach(s => {
    const pct = seasonPercent(plants,s);
    q(`[data-season-${s}-label]`)!.textContent = `${pct}%`;
    (q(`[data-season-${s}]`) as HTMLElement).style.width = `${pct}%`;
  });
  updateComposition(bed);
};

const updateSiteControls = (bed?:BedState) => {
  const sun = q<HTMLSelectElement>('[data-bed-sun]');
  const moisture = q<HTMLSelectElement>('[data-bed-moisture]');
  const ph = q<HTMLSelectElement>('[data-bed-ph]');
  const front = q<HTMLSelectElement>('[data-bed-front]');
  const context = q('[data-site-context]');
  [sun,moisture,ph,front].forEach(select => { if (select) select.disabled = !bed; });

  if (!bed) {
    if (context) context.textContent='brak rabaty';
    return;
  }

  if (sun) sun.value=bed.sun;
  if (moisture) moisture.value=bed.moisture;
  if (ph) ph.value=bed.ph;
  if (front) front.value=bed.frontEdge;
  if (context) context.textContent=bed.name;
};

const formatList = <T extends string>(values:T[], labels:Record<T,string>) =>
  values.map(value=>labels[value]).join(', ');

const updatePlantRequirements = (plant?:PlantState, bed?:BedState) => {
  const panel = q<HTMLElement>('[data-plant-requirements]');
  if (panel) panel.hidden = !plant;
  if (!plant) return;

  q('[data-plant-sun]')!.textContent = formatList(plant.sun,sunLabels);
  q('[data-plant-moisture]')!.textContent = formatList(plant.moisture,moistureLabels);
  q('[data-plant-ph]')!.textContent = formatList(plant.ph,phLabels);
  q('[data-plant-soil]')!.textContent = plant.soil;

  const fit = q<HTMLElement>('[data-plant-fit]');
  const moveBest=q<HTMLButtonElement>('[data-move-best-bed]');
  const fixSpacing=q<HTMLButtonElement>('[data-fix-spacing]');
  if (moveBest) moveBest.disabled=!plant || state.beds.length===0;
  if (fixSpacing) fixSpacing.disabled=!plant || !bed;
  if (!fit) return;
  if (!bed) {
    fit.className='compatibility-status warn';
    fit.textContent='Roślina jest poza rabatą — nie można ocenić stanowiska.';
    return;
  }

  const result = fitPlantToBed(plant,bed);
  if (result.score === 100) {
    fit.className='compatibility-status good';
    fit.textContent=`Dobre dopasowanie do rabaty „${bed.name}” — 100%.`;
  } else {
    fit.className='compatibility-status warn';
    fit.textContent=`Dopasowanie ${result.score}%. Sprawdź: ${result.issues.join(' · ')}.`;
  }
};

const getSelectedPlants = () => {
  const ids = multiSelectedIds.size
    ? [...multiSelectedIds]
    : state.selected?.type==='plant'
      ? [state.selected.id]
      : [];
  return ids
    .map(id=>state.plants.find(plant=>plant.id===id))
    .filter((plant): plant is PlantState => Boolean(plant));
};

const updateDesignerTools = () => {
  const plants=getSelectedPlants();
  const counter=q('[data-selection-count]');
  if (counter) counter.textContent=`${plants.length} ${plants.length===1?'zaznaczona':'zaznaczone'}`;

  const hasPlant=plants.length>0;
  qa<HTMLButtonElement>('[data-group-size]').forEach(button=>button.disabled=!hasPlant || plants.length>1);

  const duplicate=q<HTMLButtonElement>('[data-duplicate-selection]');
  if (duplicate) duplicate.disabled=!hasPlant;

  const paint=q<HTMLButtonElement>('[data-paint-mode]');
  if (paint) {
    paint.disabled=!hasPlant || plants.length!==1;
    paint.classList.toggle('active-tool', paintMode);
    paint.textContent=paintMode ? 'Pędzel: ON' : 'Pędzel nasadzeń';
  }
  scene.classList.toggle('paint-mode',paintMode);

  const clear=q<HTMLButtonElement>('[data-clear-multiselect]');
  if (clear) clear.disabled=multiSelectedIds.size<2;
};

const setSinglePlantSelection = (id:string) => {
  multiSelectedIds.clear();
  multiSelectedIds.add(id);
  state.selected={type:'plant',id};
  paintSourceId=id;
};

const togglePlantSelection = (id:string) => {
  if (multiSelectedIds.has(id)) {
    multiSelectedIds.delete(id);
    if (state.selected?.type==='plant' && state.selected.id===id) {
      const next=[...multiSelectedIds][0];
      state.selected=next ? {type:'plant',id:next} : null;
      paintSourceId=next || null;
    }
  } else {
    multiSelectedIds.add(id);
    state.selected={type:'plant',id};
    paintSourceId=id;
  }
};

const clearMultiSelection = () => {
  multiSelectedIds.clear();
  if (state.selected?.type==='plant') state.selected=null;
  paintMode=false;
  paintSourceId=null;
  updateDesignerTools();
  renderMigrationViews();
};

const renderSelection = () => {
  scene.querySelectorAll<HTMLElement>('[data-plant-id]').forEach(el => {
    const id=el.dataset.plantId || '';
    el.classList.toggle('selected', state.selected?.type==='plant' && id===state.selected.id);
    el.classList.toggle('multi-selected', multiSelectedIds.has(id) && !(state.selected?.type==='plant' && id===state.selected.id));
  });
  scene.querySelectorAll<HTMLElement>('[data-bed-id]').forEach(el => {
    el.classList.toggle('selected', state.selected?.type==='bed' && el.dataset.bedId===state.selected.id);
  });

  const plant = state.selected?.type==='plant'
    ? state.plants.find(p=>p.id===state.selected?.id)
    : undefined;
  const bed = state.selected?.type==='bed'
    ? state.beds.find(b=>b.id===state.selected?.id)
    : plant
      ? getBedForPlant(plant)
      : undefined;

  const statusSelect=q<HTMLSelectElement>('[data-inspector-status]');
  if (plant) {
    if (statusSelect) { statusSelect.disabled=false; statusSelect.value=plant.status; }
    q('[data-inspector-title]')!.textContent = plant.name;
    q('[data-inspector-type]')!.textContent = 'roślina';
    q('[data-inspector-bed]')!.textContent = bed?.name || 'poza rabatą';
    q('[data-inspector-position]')!.textContent = `${Math.round(plant.x)} × ${Math.round(plant.y)}`;
    q('[data-inspector-spacing]')!.textContent = `${plant.spacing} cm`;
    q('[data-inspector-spread]')!.textContent = `${Math.round(effectiveSpread(plant))} / ${plant.spread} cm`;
    q('[data-inspector-height]')!.textContent = `${Math.round(effectiveHeight(plant))} / ${plant.height} cm`;
  } else if (bed) {
    if (statusSelect) statusSelect.disabled=true;
    q('[data-inspector-title]')!.textContent = bed.name;
    q('[data-inspector-type]')!.textContent = 'rabata';
    q('[data-inspector-bed]')!.textContent = `${plantsInBed(bed).length} roślin`;
    q('[data-inspector-position]')!.textContent = `${Math.round(bed.x)} × ${Math.round(bed.y)}`;
    q('[data-inspector-spacing]')!.textContent = `${Math.round(bed.width)} × ${Math.round(bed.height)}%`;
    q('[data-inspector-spread]')!.textContent = '—';
    q('[data-inspector-height]')!.textContent = '—';
  } else {
    if (statusSelect) statusSelect.disabled=true;
    q('[data-inspector-title]')!.textContent='Plan ogrodu';
    q('[data-inspector-type]')!.textContent='projekt';
    q('[data-inspector-bed]')!.textContent='—';
    q('[data-inspector-position]')!.textContent='—';
    q('[data-inspector-spacing]')!.textContent='—';
    q('[data-inspector-spread]')!.textContent='—';
    q('[data-inspector-height]')!.textContent='—';
  }

  updatePlantRequirements(plant,bed);
  updateSiteControls(bed);
  updateBedAnalytics(bed);
  renderAnalysis();
  updateLibrary();
  updateDesignerTools();
};

const fitGroupInsideBed = (points:Array<{x:number;y:number}>, bed:BedState) => {
  if (!points.length) return points;
  const minX=Math.min(...points.map(p=>p.x));
  const maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y));
  const maxY=Math.max(...points.map(p=>p.y));
  let dx=0,dy=0;
  if (minX<bed.x+2) dx=(bed.x+2)-minX;
  if (maxX>bed.x+bed.width-2) dx=(bed.x+bed.width-2)-maxX;
  if (minY<bed.y+2) dy=(bed.y+2)-minY;
  if (maxY>bed.y+bed.height-2) dy=(bed.y+bed.height-2)-maxY;
  return points.map(point=>({x:point.x+dx,y:point.y+dy}));
};

const createOddGroup = (count:3|5|7) => {
  if (state.selected?.type!=='plant' || multiSelectedIds.size>1) return;
  const base=state.plants.find(p=>p.id===state.selected?.id);
  if (!base) return;
  const bed=getBedForPlant(base) || bestBedForPlant(base);
  if (!bed) return;

  pushHistory();

  const centre=getBedForPlant(base)
    ? {x:base.x,y:base.y}
    : candidatePosition(bed,effectiveSpread(base),base.id);

  const required=Math.max(4,effectiveSpread(base)/18);
  const radius=count===3 ? required/1.55 : count===5 ? required/1.08 : required;
  const points:Array<{x:number;y:number}>=[];

  if (count===7) {
    points.push({x:centre.x,y:centre.y});
    for (let i=0;i<6;i++) {
      const angle=(-Math.PI/2)+(i*Math.PI/3);
      points.push({x:centre.x+Math.cos(angle)*radius,y:centre.y+Math.sin(angle)*radius});
    }
  } else {
    for (let i=0;i<count;i++) {
      const angle=(-Math.PI/2)+(i*Math.PI*2/count);
      points.push({x:centre.x+Math.cos(angle)*radius,y:centre.y+Math.sin(angle)*radius});
    }
  }

  const fitted=fitGroupInsideBed(points,bed).map(point=>({x:snap(point.x),y:snap(point.y)}));
  base.x=fitted[0].x;
  base.y=fitted[0].y;

  multiSelectedIds.clear();
  multiSelectedIds.add(base.id);

  for (let i=1;i<fitted.length;i++) {
    const clonePlant:PlantState={
      ...clone(base),
      id:`p-group-${Date.now()}-${i}`,
      x:fitted[i].x,
      y:fitted[i].y,
      status:'planned',
    };
    state.plants.push(clonePlant);
    multiSelectedIds.add(clonePlant.id);
  }

  state.selected={type:'plant',id:base.id};
  paintSourceId=base.id;
  syncScene();
  scheduleSave();
};

const duplicateSelection = () => {
  const plants=getSelectedPlants();
  if (!plants.length) return;

  const bedIds=new Set(plants.map(plant=>getBedForPlant(plant)?.id).filter(Boolean));
  if (bedIds.size!==1) {
    const badge=q('[data-save-badge]');
    if (badge) badge.textContent='wybierz grupę w jednej rabacie';
    return;
  }

  const bed=state.beds.find(item=>item.id===[...bedIds][0]);
  if (!bed) return;

  pushHistory();

  const step=Math.max(5,Math.max(...plants.map(plant=>effectiveSpread(plant)/18))*1.15);
  const candidates=[[step,0],[-step,0],[0,step],[0,-step],[step,step],[-step,step],[step,-step],[-step,-step]];
  const selectedSet=new Set(plants.map(plant=>plant.id));
  const obstacles=plantsInBed(bed).filter(plant=>!selectedSet.has(plant.id));
  let offset={x:step,y:step};

  for (const [dx,dy] of candidates) {
    const placements=plants.map(plant=>({plant,x:plant.x+dx,y:plant.y+dy}));
    const inside=placements.every(({x,y})=>x>=bed.x+2&&x<=bed.x+bed.width-2&&y>=bed.y+2&&y<=bed.y+bed.height-2);
    const clear=inside && placements.every(({plant,x,y})=>obstacles.every(other=>{
      const required=Math.max(3.5,((effectiveSpread(plant)+effectiveSpread(other))/2)/18);
      return Math.hypot(x-other.x,y-other.y)>=required*.92;
    }));
    if (clear) {
      offset={x:dx,y:dy};
      break;
    }
  }

  multiSelectedIds.clear();
  const duplicates=plants.map((plant,index)=>{
    const next:PlantState={
      ...clone(plant),
      id:`p-dup-${Date.now()}-${index}`,
      x:snap(plant.x+offset.x),
      y:snap(plant.y+offset.y),
      status:'planned',
    };
    state.plants.push(next);
    multiSelectedIds.add(next.id);
    return next;
  });

  if (duplicates[0]) {
    state.selected={type:'plant',id:duplicates[0].id};
    paintSourceId=duplicates[0].id;
  }
  syncScene();
  scheduleSave();
};

const canPlantAt = (source:PlantState, bed:BedState, x:number, y:number) => {
  if (x<bed.x+1 || x>bed.x+bed.width-1 || y<bed.y+1 || y>bed.y+bed.height-1) return false;
  return plantsInBed(bed).every(other=>{
    const required=Math.max(3.5,((effectiveSpread(source)+effectiveSpread(other))/2)/18);
    return Math.hypot(x-other.x,y-other.y)>=required*.92;
  });
};

const paintPlantAt = (clientX:number,clientY:number) => {
  const source=paintSourceId ? state.plants.find(p=>p.id===paintSourceId) : undefined;
  if (!source) return false;
  const rect=scene.getBoundingClientRect();
  const x=snap(clamp(((clientX-rect.left)/rect.width)*100,2,98));
  const y=snap(clamp(((clientY-rect.top)/rect.height)*100,3,97));
  const bed=state.beds.find(item=>x>=item.x&&x<=item.x+item.width&&y>=item.y&&y<=item.y+item.height);
  if (!bed || !canPlantAt(source,bed,x,y)) return false;
  if (lastPaintPoint && Math.hypot(x-lastPaintPoint.x,y-lastPaintPoint.y)<Math.max(2.5,effectiveSpread(source)/22)) return false;

  paintSequence+=1;
  const next:PlantState={
    ...clone(source),
    id:`p-paint-${Date.now()}-${paintSequence}`,
    x,y,
    status:'planned',
  };
  state.plants.push(next);
  lastPaintPoint={x,y};
  multiSelectedIds.add(next.id);
  createPlantElement(next);
  renderSelection();
  scheduleSave();
  return true;
};

const syncScene = () => {
  scene.querySelectorAll('[data-plant-id],[data-bed-id]').forEach(el=>el.remove());
  state.beds.forEach(createBedElement);
  state.plants.forEach(createPlantElement);
  renderSelection();
};

scene.addEventListener('pointerdown', event => {
  const target = event.target as HTMLElement;

  if (paintMode && !target.closest('[data-plant-id]') && !target.closest('[data-resize-bed]')) {
    const source=paintSourceId ? state.plants.find(p=>p.id===paintSourceId) : undefined;
    if (source) {
      pushHistory();
      multiSelectedIds.clear();
      multiSelectedIds.add(source.id);
      lastPaintPoint=null;
      paintStroke=true;
      scene.setPointerCapture(event.pointerId);
      paintPlantAt(event.clientX,event.clientY);
      return;
    }
  }

  const resize = target.closest<HTMLElement>('[data-resize-bed]');
  if (resize?.dataset.resizeBed) {
    const b = state.beds.find(x=>x.id===resize.dataset.resizeBed);
    if (!b) return;
    pushHistory();
    interaction={type:'resize',id:b.id,startX:event.clientX,startY:event.clientY,startW:b.width,startH:b.height};
    state.selected={type:'bed',id:b.id};
    resize.setPointerCapture(event.pointerId);
    renderSelection();
    return;
  }

  const plantEl = target.closest<HTMLElement>('[data-plant-id]');
  if (plantEl?.dataset.plantId) {
    const id=plantEl.dataset.plantId;
    const additive=event.shiftKey || event.ctrlKey || event.metaKey;
    if (additive) {
      togglePlantSelection(id);
      paintMode=false;
      renderSelection();
      scheduleSave();
      return;
    }

    const keepGroup=multiSelectedIds.size>1 && multiSelectedIds.has(id);
    if (!keepGroup) setSinglePlantSelection(id);
    else {
      state.selected={type:'plant',id};
      paintSourceId=id;
    }
    const activePlants=getSelectedPlants();
    const anchor=state.plants.find(p=>p.id===id);
    if (!anchor) return;
    const rect=plantEl.getBoundingClientRect();
    pushHistory();
    interaction={
      type:'plant',
      id,
      offsetX:event.clientX-rect.left-rect.width/2,
      offsetY:event.clientY-rect.top-rect.height/2,
      startX:anchor.x,
      startY:anchor.y,
      members:activePlants.map(p=>({id:p.id,x:p.x,y:p.y})),
    };
    plantEl.setPointerCapture(event.pointerId);
    plantEl.classList.add('dragging');
    renderSelection();
    return;
  }

  const bedEl = target.closest<HTMLElement>('[data-bed-id]');
  if (bedEl?.dataset.bedId) {
    const b=state.beds.find(x=>x.id===bedEl.dataset.bedId);
    if (!b) return;
    const rect=bedEl.getBoundingClientRect();
    pushHistory();
    interaction={
      type:'bed',
      id:bedEl.dataset.bedId,
      offsetX:event.clientX-rect.left,
      offsetY:event.clientY-rect.top,
      startBedX:b.x,
      startBedY:b.y,
      members:plantsInBed(b).map(p=>({id:p.id,x:p.x,y:p.y})),
    };
    multiSelectedIds.clear();
    paintMode=false;
    paintSourceId=null;
    state.selected={type:'bed',id:bedEl.dataset.bedId};
    bedEl.setPointerCapture(event.pointerId);
    bedEl.classList.add('dragging');
    renderSelection();
    return;
  }

  multiSelectedIds.clear();
  paintMode=false;
  paintSourceId=null;
  state.selected=null;
  renderSelection();
});

scene.addEventListener('pointermove', event => {
  if (paintStroke) {
    paintPlantAt(event.clientX,event.clientY);
    return;
  }
  if (!interaction) return;
  const rect=scene.getBoundingClientRect();

  if (interaction.type==='plant') {
    const anchor=state.plants.find(x=>x.id===interaction.id);
    if (!anchor) return;
    const targetX=snap(((event.clientX-rect.left-interaction.offsetX)/rect.width)*100);
    const targetY=snap(((event.clientY-rect.top-interaction.offsetY)/rect.height)*100);
    const minDx=Math.max(...interaction.members.map(member=>2-member.x));
    const maxDx=Math.min(...interaction.members.map(member=>98-member.x));
    const minDy=Math.max(...interaction.members.map(member=>3-member.y));
    const maxDy=Math.min(...interaction.members.map(member=>97-member.y));
    const dx=clamp(targetX-interaction.startX,minDx,maxDx);
    const dy=clamp(targetY-interaction.startY,minDy,maxDy);
    interaction.members.forEach(member=>{
      const plant=state.plants.find(item=>item.id===member.id);
      const el=scene.querySelector<HTMLElement>(`[data-plant-id="${member.id}"]`);
      if (!plant||!el) return;
      plant.x=member.x+dx;
      plant.y=member.y+dy;
      setPlantPosition(el,plant);
    });
  } else if (interaction.type==='bed') {
    const b=state.beds.find(x=>x.id===interaction.id);
    const el=scene.querySelector<HTMLElement>(`[data-bed-id="${interaction.id}"]`);
    if (!b||!el) return;
    const nextX=clamp(snap(((event.clientX-rect.left-interaction.offsetX)/rect.width)*100),1,99-b.width);
    const nextY=clamp(snap(((event.clientY-rect.top-interaction.offsetY)/rect.height)*100),1,99-b.height);
    const dx=nextX-interaction.startBedX;
    const dy=nextY-interaction.startBedY;
    b.x=nextX;
    b.y=nextY;
    interaction.members.forEach(member=>{
      const plant=state.plants.find(p=>p.id===member.id);
      const plantEl=scene.querySelector<HTMLElement>(`[data-plant-id="${member.id}"]`);
      if (!plant||!plantEl) return;
      plant.x=clamp(member.x+dx,2,98);
      plant.y=clamp(member.y+dy,3,97);
      setPlantPosition(plantEl,plant);
    });
    setBedGeometry(el,b);
  } else {
    const b=state.beds.find(x=>x.id===interaction?.id);
    const el=scene.querySelector<HTMLElement>(`[data-bed-id="${interaction.id}"]`);
    if (!b||!el) return;
    const dx=((event.clientX-interaction.startX)/rect.width)*100;
    const dy=((event.clientY-interaction.startY)/rect.height)*100;
    b.width=clamp(snap(interaction.startW+dx),10,98-b.x);
    b.height=clamp(snap(interaction.startH+dy),10,98-b.y);
    setBedGeometry(el,b);
  }

  renderSelection();
  scheduleSave();
});

const stopInteraction=()=>{
  document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));
  interaction=null;
  paintStroke=false;
  lastPaintPoint=null;
};
scene.addEventListener('pointerup',stopInteraction);
scene.addEventListener('pointercancel',stopInteraction);

const setZoom=(next:number)=>{
  state.zoom=clamp(next,.6,1.8);
  scene.style.transform=`scale(${state.zoom})`;
  q('[data-zoom-label]')!.textContent=`${Math.round(state.zoom*100)}%`;
  scheduleSave();
};

q('[data-zoom-in]')?.addEventListener('click',()=>setZoom(state.zoom+.1));
q('[data-zoom-out]')?.addEventListener('click',()=>setZoom(state.zoom-.1));
q('[data-zoom-reset]')?.addEventListener('click',()=>setZoom(1));
q('[data-fit]')?.addEventListener('click',()=>setZoom(.9));
q('[data-undo]')?.addEventListener('click',undo);
q('[data-redo]')?.addEventListener('click',redo);


qa<HTMLElement>('[data-open-view]').forEach(button=>{
  button.addEventListener('click',()=>openWorkspaceView(button.dataset.openView||'planner',button));
});
qa<HTMLElement>('[data-close-view]').forEach(button=>{
  button.addEventListener('click',()=>openWorkspaceView('planner'));
});

qa<HTMLButtonElement>('[data-layer-toggle]').forEach(button=>{
  button.addEventListener('click',()=>{
    if (button.dataset.layerToggle==='planted') state.showPlanted=!state.showPlanted;
    if (button.dataset.layerToggle==='planned') state.showPlanned=!state.showPlanned;
    renderSelection();
    scheduleSave();
  });
});

q<HTMLSelectElement>('[data-inspector-status]')?.addEventListener('change',e=>{
  if (state.selected?.type!=='plant') return;
  const plant=state.plants.find(item=>item.id===state.selected?.id);
  if (!plant) return;
  pushHistory();
  plant.status=(e.currentTarget as HTMLSelectElement).value as PlantStatus;
  renderSelection();
  scheduleSave();
});

document.addEventListener('change',event=>{
  const target=event.target as HTMLSelectElement;
  if (target.matches('[data-garden-status]')) {
    const id=target.dataset.gardenStatus;
    const plant=state.plants.find(item=>item.id===id);
    if (!plant) return;
    pushHistory();
    plant.status=target.value as PlantStatus;
    renderSelection();
    scheduleSave();
  }
});

document.addEventListener('click',event=>{
  const target=event.target as HTMLElement;
  const focusPlant=target.closest<HTMLElement>('[data-focus-plant]');
  if (focusPlant?.dataset.focusPlant) {
    const plant=state.plants.find(item=>item.id===focusPlant.dataset.focusPlant);
    if (!plant) return;
    setSinglePlantSelection(plant.id);
    openWorkspaceView('planner');
    renderSelection();
  }
  const focusBed=target.closest<HTMLElement>('[data-focus-bed]');
  if (focusBed?.dataset.focusBed) {
    const bed=state.beds.find(item=>item.id===focusBed.dataset.focusBed);
    if (!bed) return;
    multiSelectedIds.clear();
    state.selected={type:'bed',id:bed.id};
    openWorkspaceView('planner');
    renderSelection();
  }
});

q('[data-toggle-snap]')?.addEventListener('click',()=>{
  state.snap=!state.snap;
  q('[data-toggle-snap]')!.textContent=`Snap: ${state.snap?'ON':'OFF'}`;
  q('[data-snap-state]')!.textContent=state.snap?'10 px':'wyłączony';
  scheduleSave();
});

q('[data-add-plant]')?.addEventListener('click',()=>{
  addPlantFromTemplate({
    name:'Nowa roślina',
    latin:'Do uzupełnienia',
    short:'+',
    spacing:50,
    height:60,
    spread:60,
    bloomMonths:[],
    evergreen:false,
    seasons:['summer'],
    sun:['sun','partial','shade'],
    moisture:['dry','normal','moist'],
    ph:['acid','neutral','alkaline'],
    soil:'do uzupełnienia',
  });
});

q('[data-add-bed]')?.addEventListener('click',()=>{
  pushHistory();
  const bed:BedState={
    id:`b${Date.now()}`,
    name:`Nowa rabata ${state.beds.length+1}`,
    x:38,y:38,width:24,height:18,
    sun:'partial',moisture:'normal',ph:'neutral',frontEdge:'bottom',
  };
  state.beds.push(bed);
  state.selected={type:'bed',id:bed.id};
  createBedElement(bed);
  renderSelection();
  scheduleSave();
});

qa<HTMLElement>('[data-library-item]').forEach(item=>{
  item.addEventListener('click',()=>addPlantFromTemplate(templateFromLibraryItem(item)));
});

q<HTMLInputElement>('[data-library-search]')?.addEventListener('input',updateLibrary);
q<HTMLInputElement>('[data-compatible-filter]')?.addEventListener('change',updateLibrary);

q('[data-move-best-bed]')?.addEventListener('click',()=>{
  if (state.selected?.type!=='plant') return;
  const plant=state.plants.find(p=>p.id===state.selected?.id);
  if (!plant) return;
  const bed=bestBedForPlant(plant);
  if (!bed) return;
  pushHistory();
  const pos=candidatePosition(bed,effectiveSpread(plant),plant.id);
  plant.x=pos.x;
  plant.y=pos.y;
  syncScene();
  scheduleSave();
});

q('[data-fix-spacing]')?.addEventListener('click',()=>{
  if (state.selected?.type!=='plant') return;
  const plant=state.plants.find(p=>p.id===state.selected?.id);
  if (!plant) return;
  const bed=getBedForPlant(plant) || bestBedForPlant(plant);
  if (!bed) return;
  pushHistory();
  const pos=candidatePosition(bed,effectiveSpread(plant),plant.id);
  plant.x=pos.x;
  plant.y=pos.y;
  syncScene();
  scheduleSave();
});

const updateBedCondition = (key:'sun'|'moisture'|'ph'|'frontEdge', value:string) => {
  const bed = getContextBed();
  if (!bed) return;
  pushHistory();
  if (key==='sun') bed.sun=value as Sun;
  if (key==='moisture') bed.moisture=value as Moisture;
  if (key==='ph') bed.ph=value as SoilPh;
  if (key==='frontEdge') bed.frontEdge=value as FrontEdge;
  renderSelection();
  scheduleSave();
};

q<HTMLSelectElement>('[data-bed-sun]')?.addEventListener('change',e=>updateBedCondition('sun',(e.currentTarget as HTMLSelectElement).value));
q<HTMLSelectElement>('[data-bed-moisture]')?.addEventListener('change',e=>updateBedCondition('moisture',(e.currentTarget as HTMLSelectElement).value));
q<HTMLSelectElement>('[data-bed-ph]')?.addEventListener('change',e=>updateBedCondition('ph',(e.currentTarget as HTMLSelectElement).value));
q<HTMLSelectElement>('[data-bed-front]')?.addEventListener('change',e=>updateBedCondition('frontEdge',(e.currentTarget as HTMLSelectElement).value));

qa<HTMLButtonElement>('[data-group-size]').forEach(button=>{
  button.addEventListener('click',()=>{
    const count=Number(button.dataset.groupSize);
    if (count===3 || count===5 || count===7) createOddGroup(count);
  });
});

q('[data-duplicate-selection]')?.addEventListener('click',duplicateSelection);

q('[data-clear-multiselect]')?.addEventListener('click',()=>{
  const primary=state.selected?.type==='plant' ? state.selected.id : null;
  multiSelectedIds.clear();
  if (primary) multiSelectedIds.add(primary);
  paintMode=false;
  renderSelection();
});

q('[data-paint-mode]')?.addEventListener('click',()=>{
  const plants=getSelectedPlants();
  if (plants.length!==1) return;
  paintMode=!paintMode;
  paintSourceId=plants[0].id;
  if (paintMode) {
    multiSelectedIds.clear();
    multiSelectedIds.add(plants[0].id);
    state.selected={type:'plant',id:plants[0].id};
  }
  updateDesignerTools();
});

q('[data-auto-layout]')?.addEventListener('click',()=>{
  if (!state.beds.length) return;
  pushHistory();

  const buckets = new Map<string,PlantState[]>();
  state.beds.forEach(b=>buckets.set(b.id,[]));

  state.plants.forEach(plant=>{
    const ranked = state.beds
      .map(bed => ({
        bed,
        score:fitPlantToBed(plant,bed).score - (buckets.get(bed.id)?.length || 0)*2,
      }))
      .sort((a,b)=>b.score-a.score);
    buckets.get(ranked[0].bed.id)?.push(plant);
  });

  state.beds.forEach(bed=>{
    const plants=buckets.get(bed.id) || [];
    if (!plants.length) return;
    const aspect=Math.max(.35,bed.width/Math.max(1,bed.height));
    const cols=Math.max(1,Math.ceil(Math.sqrt(plants.length*aspect)));
    const rows=Math.max(1,Math.ceil(plants.length/cols));

    const positions=plants.map((_,i)=>{
      const col=i%cols;
      const row=Math.floor(i/cols);
      const x=snap(bed.x + bed.width*((col+1)/(cols+1)));
      const y=snap(bed.y + bed.height*((row+1)/(rows+1)));
      return {x,y,backness:plantBackness({x,y},bed)};
    }).sort((a,b)=>b.backness-a.backness);
    const ordered=[...plants].sort((a,b)=>effectiveHeight(b)-effectiveHeight(a));
    ordered.forEach((plant,i)=>{
      plant.x=positions[i].x;
      plant.y=positions[i].y;
    });
  });

  syncScene();
  scheduleSave();
});

q<HTMLInputElement>('[data-growth-year]')?.addEventListener('input',e=>{
  state.growthYear=clamp(Number((e.currentTarget as HTMLInputElement).value)||3,1,5);
  q('[data-growth-label]')!.textContent=`rok ${state.growthYear}/5`;
  state.plants.forEach(plant=>{
    const el=scene.querySelector<HTMLElement>(`[data-plant-id="${plant.id}"]`);
    if (el) setPlantPosition(el,plant);
  });
  renderSelection();
  scheduleSave();
});

qa<HTMLButtonElement>('[data-month]').forEach(button=>{
  button.addEventListener('click',()=>{
    state.currentMonth=clamp(Number(button.dataset.month)||0,0,12);
    qa<HTMLButtonElement>('[data-month]').forEach(item=>item.classList.toggle('active',item===button));
    renderSelection();
    scheduleSave();
  });
});

q('[data-reset-project]')?.addEventListener('click',()=>{
  pushHistory();
  localStorage.removeItem(STORAGE_KEY);
  state.plants=clone(initialPlants);
  state.beds=clone(initialBeds);
  state.selected={type:'plant',id:'p1'};
  multiSelectedIds.clear();
  multiSelectedIds.add('p1');
  paintSourceId='p1';
  paintMode=false;
  state.snap=true;
  state.showPlanted=true;
  state.showPlanned=true;
  state.growthYear=3;
  state.currentMonth=0;
  syncScene();
  setZoom(1);
  q('[data-toggle-snap]')!.textContent='Snap: ON';
  q('[data-snap-state]')!.textContent='10 px';
  const growth=q<HTMLInputElement>('[data-growth-year]');
  if (growth) growth.value='3';
  q('[data-growth-label]')!.textContent='rok 3/5';
  qa<HTMLButtonElement>('[data-month]').forEach(btn=>btn.classList.toggle('active',btn.dataset.month==='0'));
});


const projectPayload=()=>({
  format:'moj-ogrod-planner',
  version:6,
  exportedAt:new Date().toISOString(),
  project:{name:'Ogród domowy',location:'Rzeszów'},
  plants:state.plants,
  beds:state.beds,
  simulation:{growthYear:state.growthYear,currentMonth:state.currentMonth},
  layers:{showPlanted:state.showPlanted,showPlanned:state.showPlanned},
});

const downloadContent=(content:string,type:string,filename:string)=>{
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),0);
};

const csvCell=(value:unknown)=>{
  const text=String(value??'');
  return `"${text.replaceAll('"','""')}"`;
};

const buildPlantsCsv=()=>{
  const headers=['ID','Nazwa','Nazwa łacińska','Status','Rabata','Dopasowanie %','X','Y','Rozstaw cm','Szerokość docelowa cm','Wysokość docelowa cm','Światło','Wilgotność','pH','Podłoże','Kwitnienie'];
  const rows=state.plants.map(plant=>{
    const bed=getBedForPlant(plant);
    const fit=bed ? fitPlantToBed(plant,bed).score : '';
    return [
      plant.id,plant.name,plant.latin||'',plant.status==='planted'?'posadzona':'planowana',
      bed?.name||'',fit,Math.round(plant.x),Math.round(plant.y),plant.spacing,plant.spread,plant.height,
      formatList(plant.sun,sunLabels),formatList(plant.moisture,moistureLabels),formatList(plant.ph,phLabels),
      plant.soil,plant.bloomMonths.join(','),
    ].map(csvCell).join(';');
  });
  return '\uFEFF'+[headers.map(csvCell).join(';'),...rows].join('\n');
};

const buildReportHtml=()=>{
  const shoppingRows=buildShoppingRows();
  const budgetTotal=shoppingRows.reduce((sum,row)=>sum+(budgetPrices[row.key]||0)*row.quantity,0);
  const planted=state.plants.filter(p=>p.status==='planted').length;
  const planned=state.plants.length-planted;
  const collisions=getCollisionIds().size;
  const outside=state.plants.filter(p=>!getBedForPlant(p)).length;
  const mismatch=state.plants.filter(p=>{
    const bed=getBedForPlant(p);
    return bed ? fitPlantToBed(p,bed).score<100 : false;
  }).length;

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>Raport Mój Ogród</title>
<style>
body{font-family:Arial,sans-serif;color:#1f2a1f;margin:34px;line-height:1.4}h1,h2{margin:0 0 10px}h2{margin-top:28px;font-size:18px}
.meta{color:#697469;margin-bottom:22px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
.kpis div,.bed{border:1px solid #d9dfd3;border-radius:10px;padding:12px}.kpis span{display:block;color:#697469;font-size:11px}.kpis strong{font-size:22px}
table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:7px 8px;border-bottom:1px solid #e6e9e2;text-align:left;vertical-align:top}th{background:#f4f6f0}
.beds{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.bed h3{margin:0 0 8px}.muted{color:#697469}
@media print{body{margin:15mm}.no-print{display:none}.kpis,.beds{break-inside:avoid}tr{break-inside:avoid}}
</style></head><body>
<h1>Mój Ogród — raport projektu</h1><div class="meta">Ogród domowy · Rzeszów · eksport ${new Date().toLocaleString('pl-PL')}</div>
<div class="kpis">
<div><span>Rośliny</span><strong>${state.plants.length}</strong><small>${planted} posadzonych · ${planned} planowanych</small></div>
<div><span>Rabaty</span><strong>${state.beds.length}</strong><small>rok wzrostu ${state.growthYear}/5</small></div>
<div><span>Problemy</span><strong>${collisions+mismatch+outside}</strong><small>${collisions} kolizji · ${mismatch} stanowisko · ${outside} poza rabatą</small></div>
<div><span>Budżet</span><strong>${formatMoney.format(budgetTotal)}</strong><small>na podstawie wpisanych cen</small></div>
</div>
<h2>Rabaty</h2><div class="beds">
${state.beds.map(bed=>`<div class="bed"><h3>${escapeHtml(bed.name)}</h3><div class="muted">${plantsInBed(bed).length} roślin · pokrycie ${coverageForBed(bed)}% · fit ${bedFitPercent(bed)}% · warstwowanie ${layeringScore(bed)}%</div><div>Światło: ${sunLabels[bed.sun]} · wilgotność: ${moistureLabels[bed.moisture]} · pH: ${phLabels[bed.ph]}</div></div>`).join('')}
</div>
<h2>Rośliny</h2>
<table><thead><tr><th>Roślina</th><th>Status</th><th>Rabata</th><th>Stanowisko</th><th>Gabaryt</th><th>Kwitnienie</th></tr></thead><tbody>
${state.plants.map(plant=>{const bed=getBedForPlant(plant);const fit=bed?fitPlantToBed(plant,bed).score:null;return `<tr><td><strong>${escapeHtml(plant.name)}</strong><br><span class="muted">${escapeHtml(plant.latin||'')}</span></td><td>${plant.status==='planted'?'posadzona':'planowana'}</td><td>${escapeHtml(bed?.name||'poza rabatą')}</td><td>${fit===null?'—':fit+'%'}</td><td>${plant.spread} × ${plant.height} cm</td><td>${plant.bloomMonths.join(', ')||'—'}</td></tr>`}).join('')}
</tbody></table>
<h2>Zakupy</h2>
<table><thead><tr><th>Typ</th><th>Pozycja</th><th>Ilość</th><th>Cena jedn.</th><th>Razem</th></tr></thead><tbody>
${shoppingRows.map(row=>{const price=budgetPrices[row.key]||0;return `<tr><td>${row.section}</td><td>${escapeHtml(row.name)}</td><td>${row.quantity} ${row.unit}</td><td>${formatMoney.format(price)}</td><td>${formatMoney.format(price*row.quantity)}</td></tr>`}).join('')}
</tbody></table>
</body></html>`;
};

const firstArray=(...values:unknown[])=>values.find(Array.isArray) as any[]|undefined;
const normalizeMobileStatus=(value:unknown):PlantStatus=>{
  const status=String(value||'').toLowerCase();
  if (['planted','posadzona','posadzone','active','existing'].includes(status)) return 'planted';
  return 'planned';
};

const adaptImportedBackup=(parsed:any)=>{
  if (parsed?.format==='moj-ogrod-planner' && Array.isArray(parsed.plants)) {
    return {
      source:'planner',
      plants:parsed.plants.map((plant:Partial<PlantState>,i:number)=>normalisePlant(plant,i)),
      beds:Array.isArray(parsed.beds) ? parsed.beds.map((bed:Partial<BedState>,i:number)=>normaliseBed(bed,i)) : clone(initialBeds),
      simulation:parsed.simulation,
      layers:parsed.layers,
    };
  }

  const root=parsed?.data || parsed?.project || parsed?.garden || parsed;
  const species=firstArray(parsed?.plantSpecies,parsed?.species,parsed?.catalog,root?.plantSpecies,root?.species) || [];
  const speciesById=new Map(species.map((item:any)=>[String(item.id ?? item.catalogId ?? item.uuid ?? ''),item]));
  const rawPlants=firstArray(
    parsed?.plantInstances,parsed?.plants,root?.plantInstances,root?.plants,
    parsed?.garden?.plants,parsed?.project?.plants,
  );
  const rawBeds=firstArray(
    parsed?.sectors,parsed?.beds,root?.sectors,root?.beds,
    parsed?.garden?.sectors,parsed?.project?.sectors,
  );

  if (!rawPlants?.length) throw new Error('Brak roślin w backupie');

  const plants=rawPlants.map((raw:any,index:number)=>{
    const speciesId=String(raw.speciesId ?? raw.catalogId ?? raw.plantSpeciesId ?? '');
    const base=speciesById.get(speciesId) || {};
    const merged={...base,...raw};
    const position=raw.position || raw.layout || raw.planner || {};
    const name=merged.namePl || merged.polishName || merged.name || merged.commonName || merged.title || 'Roślina';
    const plant=normalisePlant({
      id:String(raw.id ?? raw.uuid ?? `mobile-${index}`),
      name,
      latin:merged.latinName || merged.latin || merged.scientificName,
      short:merged.short || String(name).slice(0,2),
      x:raw.x ?? position.x ?? 50,
      y:raw.y ?? position.y ?? 50,
      spacing:merged.spacing ?? merged.spacingCm ?? merged.plantSpacing,
      height:merged.height ?? merged.targetHeight ?? merged.heightCm,
      spread:merged.spread ?? merged.width ?? merged.targetWidth ?? merged.widthCm,
      bloomMonths:merged.bloomMonths ?? merged.floweringMonths,
      evergreen:merged.evergreen,
      seasons:merged.seasons,
      sun:merged.sun ?? merged.light,
      moisture:merged.moisture,
      ph:merged.ph,
      soil:merged.soil ?? merged.soilType,
      status:normalizeMobileStatus(raw.status ?? raw.state ?? raw.plantingStatus),
    },index);
    plant.status=normalizeMobileStatus(raw.status ?? raw.state ?? raw.plantingStatus);
    return plant;
  });

  const beds=rawBeds?.length
    ? rawBeds.map((raw:any,index:number)=>{
        const bounds=raw.bounds || raw.layout || raw.rect || {};
        return normaliseBed({
          id:String(raw.id ?? raw.uuid ?? `sector-${index}`),
          name:raw.name || raw.title || `Sektor ${index+1}`,
          x:raw.x ?? bounds.x ?? 15+index*8,
          y:raw.y ?? bounds.y ?? 18+index*8,
          width:raw.width ?? bounds.width ?? 30,
          height:raw.height ?? bounds.height ?? 22,
          sun:raw.sun ?? raw.light,
          moisture:raw.moisture,
          ph:raw.ph,
          frontEdge:raw.frontEdge,
        },index);
      })
    : clone(initialBeds);

  return {
    source:'mobile',
    plants,
    beds,
    simulation:parsed?.simulation || root?.simulation,
    layers:parsed?.layers || root?.layers,
  };
};

q('[data-export-project]')?.addEventListener('click',()=>{
  downloadContent(JSON.stringify(projectPayload(),null,2),'application/json',`moj-ogrod-${new Date().toISOString().slice(0,10)}.json`);
});

q('[data-export-csv]')?.addEventListener('click',()=>{
  downloadContent(buildPlantsCsv(),'text/csv;charset=utf-8',`moj-ogrod-rosliny-${new Date().toISOString().slice(0,10)}.csv`);
});

q('[data-export-html]')?.addEventListener('click',()=>{
  downloadContent(buildReportHtml(),'text/html;charset=utf-8',`moj-ogrod-raport-${new Date().toISOString().slice(0,10)}.html`);
});

q('[data-export-pdf]')?.addEventListener('click',()=>{
  const report=window.open('','_blank');
  if (!report) {
    const badge=q('[data-save-badge]');
    if (badge) badge.textContent='zezwól na nowe okno';
    return;
  }
  report.document.open();
  report.document.write(buildReportHtml());
  report.document.close();
  report.addEventListener('load',()=>window.setTimeout(()=>report.print(),150));
  window.setTimeout(()=>report.print(),350);
});

q('[data-import-project]')?.addEventListener('click',()=>q<HTMLInputElement>('[data-import-input]')?.click());
q<HTMLInputElement>('[data-import-input]')?.addEventListener('change',async e=>{
  const input=e.currentTarget as HTMLInputElement;
  const file=input.files?.[0];
  if (!file) return;
  try {
    const parsed=JSON.parse(await file.text());
    const imported=adaptImportedBackup(parsed);
    pushHistory();
    state.plants=imported.plants;
    state.beds=imported.beds;
    if (imported.layers) {
      state.showPlanted=imported.layers.showPlanted ?? true;
      state.showPlanned=imported.layers.showPlanned ?? true;
    }
    if (imported.simulation) {
      state.growthYear=clamp(Number(imported.simulation.growthYear ?? imported.simulation.growth ?? 3)||3,1,5);
      state.currentMonth=clamp(Number(imported.simulation.currentMonth ?? imported.simulation.month ?? 0)||0,0,12);
      const growth=q<HTMLInputElement>('[data-growth-year]');
      if (growth) growth.value=String(state.growthYear);
      q('[data-growth-label]')!.textContent=`rok ${state.growthYear}/5`;
      qa<HTMLButtonElement>('[data-month]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.month)===state.currentMonth));
    }
    multiSelectedIds.clear();
    paintSourceId=null;
    paintMode=false;
    state.selected=state.beds[0] ? {type:'bed',id:state.beds[0].id} : state.plants[0] ? {type:'plant',id:state.plants[0].id} : null;
    syncScene();
    scheduleSave();
    const badge=q('[data-save-badge]');
    if (badge) badge.textContent=imported.source==='mobile' ? 'zaimportowano backup mobile' : 'zaimportowano projekt';
  } catch (error) {
    const badge=q('[data-save-badge]');
    if (badge) badge.textContent='błąd importu';
  } finally {
    input.value='';
  }
});

document.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  const isFormField=target.matches('input,select,textarea');

  if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='z' && !isFormField) {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }

  if ((event.key==='Delete'||event.key==='Backspace') && state.selected && !isFormField) {
    event.preventDefault();
    pushHistory();
    if (state.selected.type==='plant') {
      const ids=multiSelectedIds.size ? new Set(multiSelectedIds) : new Set([state.selected.id]);
      state.plants=state.plants.filter(x=>!ids.has(x.id));
      multiSelectedIds.clear();
      paintSourceId=null;
      paintMode=false;
    } else {
      state.beds=state.beds.filter(x=>x.id!==state.selected?.id);
    }
    state.selected=null;
    syncScene();
    scheduleSave();
  }
});

q('[data-toggle-snap]')!.textContent=`Snap: ${state.snap?'ON':'OFF'}`;
q('[data-snap-state]')!.textContent=state.snap?'10 px':'wyłączony';
const growthInput=q<HTMLInputElement>('[data-growth-year]');
if (growthInput) growthInput.value=String(state.growthYear);
q('[data-growth-label]')!.textContent=`rok ${state.growthYear}/5`;
qa<HTMLButtonElement>('[data-month]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.month)===state.currentMonth));
if (state.selected?.type==='plant') {
  multiSelectedIds.add(state.selected.id);
  paintSourceId=state.selected.id;
}
updateHistoryButtons();
syncScene();
setZoom(state.zoom);
