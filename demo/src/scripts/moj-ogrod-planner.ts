type Season = 'spring' | 'summer' | 'autumn' | 'winter';

type PlantState = {
  id: string;
  name: string;
  latin?: string;
  short: string;
  x: number;
  y: number;
  spacing: number;
  height: number;
  seasons: Season[];
};

type BedState = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Selection = { type: 'plant' | 'bed'; id: string } | null;

type PlannerState = {
  zoom: number;
  snap: boolean;
  plants: PlantState[];
  beds: BedState[];
  selected: Selection;
};

const STORAGE_KEY = 'moj-ogrod-planner-v3';
const SNAP_STEP = 2;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const initialPlants: PlantState[] = [
  { id:'p1', name:'Hortensja bukietowa', short:'H', x:22, y:25, spacing:90, height:180, seasons:['summer','autumn'] },
  { id:'p2', name:'Sosna bośniacka Compact Gem', short:'S', x:34, y:30, spacing:120, height:120, seasons:['spring','summer','autumn','winter'] },
  { id:'p3', name:'Paproć ogrodowa', short:'P', x:72, y:29, spacing:55, height:70, seasons:['spring','summer','autumn'] },
  { id:'p4', name:'Hakonechloa smukła', short:'Ha', x:80, y:39, spacing:50, height:45, seasons:['summer','autumn'] },
  { id:'p5', name:'Żurawka', short:'Ż', x:38, y:75, spacing:35, height:30, seasons:['spring','summer','autumn','winter'] },
  { id:'p6', name:'Funkia', short:'F', x:53, y:76, spacing:60, height:55, seasons:['spring','summer','autumn'] },
];

const initialBeds: BedState[] = [
  { id:'b1', name:'Rabata frontowa', x:15, y:18, width:31, height:24 },
  { id:'b2', name:'Rabata cienista', x:61, y:20, width:26, height:31 },
  { id:'b3', name:'Rabata przy tarasie', x:24, y:65, width:44, height:20 },
];

const defaultState: PlannerState = {
  zoom:1,
  snap:true,
  plants:clone(initialPlants),
  beds:clone(initialBeds),
  selected:{ type:'plant', id:'p1' },
};

const loadState = (): PlannerState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(defaultState);
    const parsed = JSON.parse(raw) as Partial<PlannerState>;
    return {
      zoom: clamp(parsed.zoom || 1, .6, 1.8),
      snap: parsed.snap ?? true,
      plants: Array.isArray(parsed.plants) ? parsed.plants : clone(initialPlants),
      beds: Array.isArray(parsed.beds) ? parsed.beds : clone(initialBeds),
      selected: parsed.selected ?? null,
    };
  } catch { return clone(defaultState); }
};

const state = loadState();
const scene = document.querySelector<HTMLElement>('[data-planner-scene]');
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
if (!scene) throw new Error('Planner scene missing.');

let saveTimer = 0;
let interaction:
  | { type:'plant'|'bed'; id:string; offsetX:number; offsetY:number }
  | { type:'resize'; id:string; startX:number; startY:number; startW:number; startH:number }
  | null = null;

const snap = (v:number) => state.snap ? Math.round(v / SNAP_STEP) * SNAP_STEP : v;

const scheduleSave = () => {
  const badge = q('[data-save-badge]');
  if (badge) badge.textContent = 'zapisywanie…';
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (badge) badge.textContent = 'zapisano';
  }, 200);
};

const getBedForPlant = (plant: PlantState) =>
  state.beds.find(bed =>
    plant.x >= bed.x &&
    plant.x <= bed.x + bed.width &&
    plant.y >= bed.y &&
    plant.y <= bed.y + bed.height
  );

const plantsInBed = (bed: BedState) => state.plants.filter(p => getBedForPlant(p)?.id === bed.id);

const getCollisionIds = () => {
  const ids = new Set<string>();
  for (let i=0; i<state.plants.length; i++) {
    for (let j=i+1; j<state.plants.length; j++) {
      const a = state.plants[i], b = state.plants[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const required = Math.max(4, ((a.spacing+b.spacing)/2)/18);
      if (dist < required) { ids.add(a.id); ids.add(b.id); }
    }
  }
  return ids;
};

const coverageForBed = (bed: BedState) => {
  const plants = plantsInBed(bed);
  if (!plants.length) return 0;
  const occupied = plants.reduce((sum,p) => sum + Math.PI * Math.pow(Math.max(1.6, p.spacing / 55), 2), 0);
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
  el.innerHTML = `<span class="bed-label">${b.name}</span><span class="bed-stats" data-bed-stats="${b.id}"></span><span class="resize-handle" data-resize-bed="${b.id}"></span>`;
  setBedGeometry(el,b);
  scene.appendChild(el);
};

const renderAnalysis = () => {
  const collisions = getCollisionIds();
  let outside = 0;

  state.plants.forEach(p => {
    const el = scene.querySelector<HTMLElement>(`[data-plant-id="${p.id}"]`);
    if (!el) return;
    const bed = getBedForPlant(p);
    el.classList.toggle('collision', collisions.has(p.id));
    el.classList.toggle('outside-bed', !bed);
    el.dataset.bedName = bed?.name || '';
    if (!bed) outside++;
  });

  state.beds.forEach(b => {
    const stat = scene.querySelector<HTMLElement>(`[data-bed-stats="${b.id}"]`);
    if (stat) stat.textContent = `${plantsInBed(b).length} roślin · ${coverageForBed(b)}%`;
  });

  const avgCoverage = state.beds.length
    ? Math.round(state.beds.reduce((sum,b) => sum + coverageForBed(b), 0) / state.beds.length)
    : 0;

  const collisionCount = collisions.size;
  const score = clamp(100 - collisionCount*7 - outside*8 - Math.max(0, 35-avgCoverage)/2, 35, 100);

  q('[data-kpi-beds]')!.textContent = String(state.beds.length);
  q('[data-kpi-plants]')!.textContent = String(state.plants.length);
  q('[data-kpi-collisions]')!.textContent = String(collisionCount);
  q('[data-kpi-coverage]')!.textContent = `${avgCoverage}%`;
  q('[data-outside-count]')!.textContent = String(outside);
  q('[data-analysis-score]')!.textContent = `${Math.round(score)}%`;
  (q('[data-analysis-progress]') as HTMLElement).style.width = `${score}%`;
  q('[data-collision-badge]')!.textContent = `${collisionCount} kolizji · ${outside} poza rabatą`;
  q('[data-collision-note]')!.textContent = outside
    ? 'Przenieś rośliny oznaczone pomarańczową obwódką do wybranej rabaty.'
    : collisionCount
      ? 'Skoryguj odległości między roślinami oznaczonymi czerwonym obrysem.'
      : 'Układ nie zawiera oczywistych konfliktów.';
  q('[data-analysis-copy]')!.textContent =
    `Średnie pokrycie rabat: ${avgCoverage}%. Poza rabatami: ${outside}. Konflikty rozstawu: ${collisionCount}.`;
};

const updateBedAnalytics = (bed?: BedState) => {
  if (!bed) {
    ['[data-bed-coverage]','[data-layer-low]','[data-layer-mid]','[data-layer-high]'].forEach(s => q(s)!.textContent='—');
    (['spring','summer','autumn','winter'] as Season[]).forEach(s => {
      q(`[data-season-${s}-label]`)!.textContent='0%';
      (q(`[data-season-${s}]`) as HTMLElement).style.width='0%';
    });
    return;
  }

  const plants = plantsInBed(bed);
  q('[data-bed-coverage]')!.textContent = `${coverageForBed(bed)}%`;
  q('[data-layer-low]')!.textContent = String(plants.filter(p=>p.height<50).length);
  q('[data-layer-mid]')!.textContent = String(plants.filter(p=>p.height>=50 && p.height<120).length);
  q('[data-layer-high]')!.textContent = String(plants.filter(p=>p.height>=120).length);

  (['spring','summer','autumn','winter'] as Season[]).forEach(s => {
    const pct = seasonPercent(plants,s);
    q(`[data-season-${s}-label]`)!.textContent = `${pct}%`;
    (q(`[data-season-${s}]`) as HTMLElement).style.width = `${pct}%`;
  });
};

const renderSelection = () => {
  scene.querySelectorAll<HTMLElement>('[data-plant-id]').forEach(el => {
    el.classList.toggle('selected', state.selected?.type==='plant' && el.dataset.plantId===state.selected.id);
  });
  scene.querySelectorAll<HTMLElement>('[data-bed-id]').forEach(el => {
    el.classList.toggle('selected', state.selected?.type==='bed' && el.dataset.bedId===state.selected.id);
  });

  const plant = state.selected?.type==='plant' ? state.plants.find(p=>p.id===state.selected!.id) : undefined;
  const bed = state.selected?.type==='bed' ? state.beds.find(b=>b.id===state.selected!.id) : plant ? getBedForPlant(plant) : undefined;

  if (plant) {
    q('[data-inspector-title]')!.textContent = plant.name;
    q('[data-inspector-type]')!.textContent = 'roślina';
    q('[data-inspector-bed]')!.textContent = bed?.name || 'poza rabatą';
    q('[data-inspector-position]')!.textContent = `${Math.round(plant.x)} × ${Math.round(plant.y)}`;
    q('[data-inspector-spacing]')!.textContent = `${plant.spacing} cm`;
    q('[data-inspector-height]')!.textContent = `${plant.height} cm`;
  } else if (bed) {
    q('[data-inspector-title]')!.textContent = bed.name;
    q('[data-inspector-type]')!.textContent = 'rabata';
    q('[data-inspector-bed]')!.textContent = `${plantsInBed(bed).length} roślin`;
    q('[data-inspector-position]')!.textContent = `${Math.round(bed.x)} × ${Math.round(bed.y)}`;
    q('[data-inspector-spacing]')!.textContent = `${Math.round(bed.width)} × ${Math.round(bed.height)}%`;
    q('[data-inspector-height]')!.textContent = '—';
  } else {
    q('[data-inspector-title]')!.textContent='Plan ogrodu';
    q('[data-inspector-type]')!.textContent='projekt';
    q('[data-inspector-bed]')!.textContent='—';
    q('[data-inspector-position]')!.textContent='—';
    q('[data-inspector-spacing]')!.textContent='—';
    q('[data-inspector-height]')!.textContent='—';
  }

  updateBedAnalytics(bed);
  renderAnalysis();
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
    interaction={type:'resize',id:b.id,startX:event.clientX,startY:event.clientY,startW:b.width,startH:b.height};
    state.selected={type:'bed',id:b.id};
    resize.setPointerCapture(event.pointerId);
    renderSelection();
    return;
  }

  const plantEl = target.closest<HTMLElement>('[data-plant-id]');
  if (plantEl?.dataset.plantId) {
    const rect=plantEl.getBoundingClientRect();
    interaction={type:'plant',id:plantEl.dataset.plantId,offsetX:event.clientX-rect.left-rect.width/2,offsetY:event.clientY-rect.top-rect.height/2};
    state.selected={type:'plant',id:plantEl.dataset.plantId};
    plantEl.setPointerCapture(event.pointerId);
    plantEl.classList.add('dragging');
    renderSelection();
    return;
  }

  const bedEl = target.closest<HTMLElement>('[data-bed-id]');
  if (bedEl?.dataset.bedId) {
    const rect=bedEl.getBoundingClientRect();
    interaction={type:'bed',id:bedEl.dataset.bedId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top};
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
    const p=state.plants.find(x=>x.id===interaction!.id);
    const el=scene.querySelector<HTMLElement>(`[data-plant-id="${interaction.id}"]`);
    if (!p||!el) return;
    p.x=clamp(snap(((event.clientX-rect.left-interaction.offsetX)/rect.width)*100),2,98);
    p.y=clamp(snap(((event.clientY-rect.top-interaction.offsetY)/rect.height)*100),3,97);
    setPlantPosition(el,p);
  } else if (interaction.type==='bed') {
    const b=state.beds.find(x=>x.id===interaction!.id);
    const el=scene.querySelector<HTMLElement>(`[data-bed-id="${interaction.id}"]`);
    if (!b||!el) return;
    b.x=clamp(snap(((event.clientX-rect.left-interaction.offsetX)/rect.width)*100),1,99-b.width);
    b.y=clamp(snap(((event.clientY-rect.top-interaction.offsetY)/rect.height)*100),1,99-b.height);
    setBedGeometry(el,b);
  } else {
    const b=state.beds.find(x=>x.id===interaction!.id);
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

const stopInteraction=()=>{ document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging')); interaction=null; };
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

q('[data-toggle-snap]')?.addEventListener('click',()=>{
  state.snap=!state.snap;
  q('[data-toggle-snap]')!.textContent=`Snap: ${state.snap?'ON':'OFF'}`;
  q('[data-snap-state]')!.textContent=state.snap?'10 px':'wyłączony';
  scheduleSave();
});

q('[data-add-plant]')?.addEventListener('click',()=>{
  const p:PlantState={id:`p${Date.now()}`,name:'Nowa roślina',short:'+',x:50,y:50,spacing:50,height:60,seasons:['summer']};
  state.plants.push(p); state.selected={type:'plant',id:p.id}; createPlantElement(p); renderSelection(); scheduleSave();
});

q('[data-add-bed]')?.addEventListener('click',()=>{
  const b:BedState={id:`b${Date.now()}`,name:`Nowa rabata ${state.beds.length+1}`,x:38,y:38,width:24,height:18};
  state.beds.push(b); state.selected={type:'bed',id:b.id}; createBedElement(b); renderSelection(); scheduleSave();
});

document.querySelectorAll<HTMLElement>('[data-library-item]').forEach(item=>{
  item.addEventListener('click',()=>{
    const p:PlantState={
      id:`p${Date.now()}`,
      name:item.dataset.libraryName||'Roślina',
      latin:item.dataset.libraryLatin,
      short:item.dataset.libraryShort||'R',
      spacing:Number(item.dataset.librarySpacing||50),
      height:Number(item.dataset.libraryHeight||60),
      seasons:(item.dataset.librarySeasons||'summer').split(',') as Season[],
      x:50,y:50
    };
    state.plants.push(p); state.selected={type:'plant',id:p.id}; createPlantElement(p); renderSelection(); scheduleSave();
  });
});

q<HTMLInputElement>('[data-library-search]')?.addEventListener('input',e=>{
  const query=(e.currentTarget.value||'').trim().toLowerCase();
  document.querySelectorAll<HTMLElement>('[data-library-item]').forEach(item=>{
    const hay=`${item.dataset.libraryName||''} ${item.dataset.libraryLatin||''}`.toLowerCase();
    item.hidden=Boolean(query)&&!hay.includes(query);
  });
});

q('[data-auto-layout]')?.addEventListener('click',()=>{
  state.beds.forEach((bed,bedIndex)=>{
    const plants=state.plants.filter((_,i)=>i%Math.max(1,state.beds.length)===bedIndex);
    const cols=Math.max(1,Math.ceil(Math.sqrt(plants.length)));
    plants.forEach((p,i)=>{
      p.x=snap(bed.x+Math.min(bed.width-3,4+(i%cols)*(bed.width/Math.max(cols,1))));
      p.y=snap(bed.y+Math.min(bed.height-3,5+Math.floor(i/cols)*(bed.height/Math.max(cols,1))));
    });
  });
  syncScene(); scheduleSave();
});

q('[data-reset-project]')?.addEventListener('click',()=>{
  localStorage.removeItem(STORAGE_KEY); Object.assign(state,clone(defaultState)); syncScene(); setZoom(1);
});

document.addEventListener('keydown',event=>{
  if ((event.key==='Delete'||event.key==='Backspace')&&state.selected) {
    if (state.selected.type==='plant') state.plants=state.plants.filter(x=>x.id!==state.selected!.id);
    else state.beds=state.beds.filter(x=>x.id!==state.selected!.id);
    state.selected=null; syncScene(); scheduleSave();
  }
});

q('[data-toggle-snap]')!.textContent=`Snap: ${state.snap?'ON':'OFF'}`;
q('[data-snap-state]')!.textContent=state.snap?'10 px':'wyłączony';
syncScene();
setZoom(state.zoom);
