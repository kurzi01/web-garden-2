type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type Sun = 'sun' | 'partial' | 'shade';
type Moisture = 'dry' | 'normal' | 'moist';
type SoilPh = 'acid' | 'neutral' | 'alkaline';
type FrontEdge = 'top' | 'bottom' | 'left' | 'right';

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
  plants: PlantState[];
  beds: BedState[];
  selected: Selection;
};

type FitResult = {
  score: number;
  issues: string[];
};

const STORAGE_KEY = 'moj-ogrod-planner-v5';
const LEGACY_STORAGE_KEYS = ['moj-ogrod-planner-v4','moj-ogrod-planner-v3'];
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

const catalog: Array<Omit<PlantState,'id'|'x'|'y'>> = [
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
  { id:'p1', ...clone(catalog[0]), x:22, y:25 },
  { id:'p2', ...clone(catalog[1]), x:34, y:30 },
  { id:'p3', ...clone(catalog[2]), x:72, y:29 },
  { id:'p4', ...clone(catalog[3]), x:80, y:39 },
  { id:'p5', ...clone(catalog[4]), x:38, y:75 },
  { id:'p6', ...clone(catalog[5]), x:53, y:76 },
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
      plants: Array.isArray(parsed.plants) ? parsed.plants.map((p,i)=>normalisePlant(p,i)) : clone(initialPlants),
      beds: Array.isArray(parsed.beds) ? parsed.beds.map((b,i)=>normaliseBed(b,i)) : clone(initialBeds),
      selected: parsed.selected ?? null,
    };
  } catch {
    return clone(defaultState);
  }
};

const state = loadState();
const scene = document.querySelector<HTMLElement>('[data-planner-scene]');
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const qa = <T extends Element = HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
if (!scene) throw new Error('Planner scene missing.');

let saveTimer = 0;
let interaction:
  | { type:'plant'; id:string; offsetX:number; offsetY:number }
  | { type:'bed'; id:string; offsetX:number; offsetY:number; startBedX:number; startBedY:number; members:Array<{id:string;x:number;y:number}> }
  | { type:'resize'; id:string; startX:number; startY:number; startW:number; startH:number }
  | null = null;

const undoStack: string[] = [];
const redoStack: string[] = [];

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

const templateFromLibraryItem = (item:HTMLElement): Omit<PlantState,'id'|'x'|'y'> => ({
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

const addPlantFromTemplate = (template:Omit<PlantState,'id'|'x'|'y'>) => {
  pushHistory();
  const bed = getContextBed();
  const position = bed ? candidatePosition(bed,template.spread*growthFactor()) : {x:50,y:50};
  const plant:PlantState = {
    id:`p${Date.now()}`,
    ...clone(template),
    ...position,
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

const renderSelection = () => {
  scene.querySelectorAll<HTMLElement>('[data-plant-id]').forEach(el => {
    el.classList.toggle('selected', state.selected?.type==='plant' && el.dataset.plantId===state.selected.id);
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

  if (plant) {
    q('[data-inspector-title]')!.textContent = plant.name;
    q('[data-inspector-type]')!.textContent = 'roślina';
    q('[data-inspector-bed]')!.textContent = bed?.name || 'poza rabatą';
    q('[data-inspector-position]')!.textContent = `${Math.round(plant.x)} × ${Math.round(plant.y)}`;
    q('[data-inspector-spacing]')!.textContent = `${plant.spacing} cm`;
    q('[data-inspector-spread]')!.textContent = `${Math.round(effectiveSpread(plant))} / ${plant.spread} cm`;
    q('[data-inspector-height]')!.textContent = `${Math.round(effectiveHeight(plant))} / ${plant.height} cm`;
  } else if (bed) {
    q('[data-inspector-title]')!.textContent = bed.name;
    q('[data-inspector-type]')!.textContent = 'rabata';
    q('[data-inspector-bed]')!.textContent = `${plantsInBed(bed).length} roślin`;
    q('[data-inspector-position]')!.textContent = `${Math.round(bed.x)} × ${Math.round(bed.y)}`;
    q('[data-inspector-spacing]')!.textContent = `${Math.round(bed.width)} × ${Math.round(bed.height)}%`;
    q('[data-inspector-spread]')!.textContent = '—';
    q('[data-inspector-height]')!.textContent = '—';
  } else {
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
};

const syncScene = () => {
  scene.querySelectorAll('[data-plant-id],[data-bed-id]').forEach(el=>el.remove());
  state.beds.forEach(createBedElement);
  state.plants.forEach(createPlantElement);
  renderSelection();
};

scene.addEventListener('pointerdown', event => {
  const target = event.target as HTMLElement;
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
    const rect=plantEl.getBoundingClientRect();
    pushHistory();
    interaction={type:'plant',id:plantEl.dataset.plantId,offsetX:event.clientX-rect.left-rect.width/2,offsetY:event.clientY-rect.top-rect.height/2};
    state.selected={type:'plant',id:plantEl.dataset.plantId};
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
    state.selected={type:'bed',id:bedEl.dataset.bedId};
    bedEl.setPointerCapture(event.pointerId);
    bedEl.classList.add('dragging');
    renderSelection();
    return;
  }

  state.selected=null;
  renderSelection();
});

scene.addEventListener('pointermove', event => {
  if (!interaction) return;
  const rect=scene.getBoundingClientRect();

  if (interaction.type==='plant') {
    const p=state.plants.find(x=>x.id===interaction?.id);
    const el=scene.querySelector<HTMLElement>(`[data-plant-id="${interaction.id}"]`);
    if (!p||!el) return;
    p.x=clamp(snap(((event.clientX-rect.left-interaction.offsetX)/rect.width)*100),2,98);
    p.y=clamp(snap(((event.clientY-rect.top-interaction.offsetY)/rect.height)*100),3,97);
    setPlantPosition(el,p);
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
  state.snap=true;
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

q('[data-export-project]')?.addEventListener('click',()=>{
  const payload={
    format:'moj-ogrod-planner',
    version:5,
    exportedAt:new Date().toISOString(),
    project:{name:'Ogród domowy',location:'Rzeszów'},
    plants:state.plants,
    beds:state.beds,
    simulation:{growthYear:state.growthYear,currentMonth:state.currentMonth},
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=`moj-ogrod-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),0);
});

q('[data-import-project]')?.addEventListener('click',()=>q<HTMLInputElement>('[data-import-input]')?.click());
q<HTMLInputElement>('[data-import-input]')?.addEventListener('change',async e=>{
  const input=e.currentTarget as HTMLInputElement;
  const file=input.files?.[0];
  if (!file) return;
  try {
    const parsed=JSON.parse(await file.text());
    if (!Array.isArray(parsed.plants) || !Array.isArray(parsed.beds)) throw new Error('Nieprawidłowy format');
    pushHistory();
    state.plants=parsed.plants.map((p:Partial<PlantState>,i:number)=>normalisePlant(p,i));
    state.beds=parsed.beds.map((b:Partial<BedState>,i:number)=>normaliseBed(b,i));
    if (parsed.simulation) {
      state.growthYear=clamp(Number(parsed.simulation.growthYear)||3,1,5);
      state.currentMonth=clamp(Number(parsed.simulation.currentMonth)||0,0,12);
      const growth=q<HTMLInputElement>('[data-growth-year]');
      if (growth) growth.value=String(state.growthYear);
      q('[data-growth-label]')!.textContent=`rok ${state.growthYear}/5`;
      qa<HTMLButtonElement>('[data-month]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.month)===state.currentMonth));
    }
    state.selected=state.beds[0] ? {type:'bed',id:state.beds[0].id} : null;
    syncScene();
    scheduleSave();
    const badge=q('[data-save-badge]');
    if (badge) badge.textContent='zaimportowano';
  } catch {
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
    if (state.selected.type==='plant') state.plants=state.plants.filter(x=>x.id!==state.selected?.id);
    else state.beds=state.beds.filter(x=>x.id!==state.selected?.id);
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
updateHistoryButtons();
syncScene();
setZoom(state.zoom);
