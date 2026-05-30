/* =====================================================
   SHADOW BLADE — NINJA RPG
   script.js  —  v2.0
   ===================================================== */

'use strict';

// ===== CONSTANTS =====

const SAVE_KEY = 'shadowblade_save';

/** XP total acumulado necesario para cada nivel */
const XP_TABLE = [0, 100, 230, 400, 620, 900, 1250, 1680, 2210, 2860, 3650,
                  4600, 5730, 7060, 8610, 10400, 12450, 14780, 17410, 20360];

/** Stats base del personaje al crearse */
const BASE_STATS = { hp: 100, sp: 50, atk: 15, def: 8, spd: 20, crit: 5, dodge: 5 };

/** Definición de clases jugables */
const CLASSES = {
  sword: {
    name: 'Sword Ninja',
    icon: '🗡️',
    sprite: '🥷',
    skillName: 'Shadow Slash',
    bonuses: { spd: 1, def: 1, dodge: 0.3 }
  },
  axe: {
    name: 'Axe Ninja',
    icon: '🪓',
    sprite: '🥷',
    skillName: 'Berserker Cut',
    bonuses: { spd: 1, atk: 1, crit: 0.3 }
  },
  hammer: {
    name: 'Hammer Ninja',
    icon: '🔨',
    sprite: '🥷',
    skillName: 'Earth Smash',
    bonuses: { spd: 1, hp: 4, def: 1 }
  }
};

/** Pool de enemigos. tier = nivel mínimo del jugador para aparición */
const ENEMIES = [
  { name: 'Rata Ninja',        sprite: '🐀', tier: 1,  hpM: 0.55, atkM: 0.65, defM: 0.5,  xp: 45,  gold: 8  },
  { name: 'Murciélago Oscuro', sprite: '🦇', tier: 1,  hpM: 0.65, atkM: 0.70, defM: 0.55, xp: 55,  gold: 12 },
  { name: 'Demonio Oni',       sprite: '👹', tier: 3,  hpM: 0.90, atkM: 0.90, defM: 0.80, xp: 80,  gold: 20 },
  { name: 'Berserker Furioso', sprite: '😡', tier: 5,  hpM: 1.00, atkM: 1.10, defM: 0.85, xp: 95,  gold: 28 },
  { name: 'Guerrero Maldito',  sprite: '💀', tier: 7,  hpM: 1.20, atkM: 1.15, defM: 1.00, xp: 120, gold: 38 },
  { name: 'Gran Demonio',      sprite: '👹', tier: 10, hpM: 1.50, atkM: 1.35, defM: 1.20, xp: 160, gold: 55 },
];

/** Configuración de stats para la pantalla de asignación de puntos */
const STAT_CONFIG = [
  { key: 'hp',    label: 'Vitalidad', icon: '❤️', desc: '+10 HP / punto',     gain: { hp: 10 } },
  { key: 'sp',    label: 'Energía',   icon: '💧', desc: '+8 MP / punto',      gain: { sp: 8  } },
  { key: 'atk',   label: 'Ataque',    icon: '⚔️', desc: '+3 ATK / punto',     gain: { atk: 3 } },
  { key: 'def',   label: 'Defensa',   icon: '🛡️', desc: '+2 DEF / punto',     gain: { def: 2 } },
  { key: 'spd',   label: 'Velocidad', icon: '⚡', desc: '+5 SPD / punto',     gain: { spd: 5 } },
  { key: 'crit',  label: 'Crítico',   icon: '🎯', desc: '+0.3% Crit / punto', gain: { crit: 0.3 } },
  { key: 'dodge', label: 'Esquiva',   icon: '💨', desc: '+0.3% Dodge / punto',gain: { dodge: 0.3 } }
];

// =====================================================
// SISTEMA DE RECURSOS
// =====================================================

/** Regeneración en Base Ninja: HP por tick */
const BASE_REGEN_HP_PER_TICK  = 1;
/** Regeneración en Base Ninja: MP por tick */
const BASE_REGEN_MP_PER_TICK  = 1;
/** Intervalo de regeneración en Base (ms) — 5s para hacer recursos estratégicos */
const BASE_REGEN_INTERVAL_MS  = 5000;

/** Recuperación tras victoria (sin auto-regen — solo simbólico) */
const HP_RECOVERY_AFTER_BATTLE = 0;   // desactivado
const MP_RECOVERY_AFTER_BATTLE = 0;   // desactivado

// Estructura para futuros drops de crafteo
// Cada enemigo puede tener: drops: [{ item, chance }]
// Items: 'hierba', 'hongo', 'cristal', 'esencia_oscura'
// Se procesan en processCraftDrops(enemy) — pendiente implementar
const CRAFT_DROP_SYSTEM_ENABLED = true;  // sistema de drops activo

// ===== GAME STATE =====

let player       = null;   // objeto personaje activo
let enemy        = null;   // objeto enemigo actual
let battleState  = null;   // estado del combate en curso
let pendingLevelUps  = []; // cola de niveles pendientes de procesar
let currentLevelUpAlloc = {}; // puntos asignados en pantalla de level-up
let selectedClassKey = null;  // clase elegida en la pantalla de clase
let levelUpCallback  = null;  // función a llamar tras confirmar level-up

// ===== INIT =====

window.addEventListener('DOMContentLoaded', () => {
  checkExistingSave();
  initArenaParticles();
});

// =====================================================
// ARENA ATMOSPHERE
// =====================================================

function initArenaParticles() {
  const container = document.getElementById('arena-particles');
  if (!container) return;
  const COLORS = [
    'rgba(0,212,255,0.7)',
    'rgba(0,160,220,0.5)',
    'rgba(255,107,53,0.5)',
    'rgba(255,215,0,0.4)',
    'rgba(180,230,255,0.5)',
  ];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'arena-particle';
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size  = Math.random() * 2.5 + 1;
    const left  = Math.random() * 90 + 5;
    const delay = Math.random() * 6;
    const dur   = Math.random() * 4 + 4;
    p.style.cssText = `background:${color};width:${size}px;height:${size}px;left:${left}%;bottom:${Math.random()*30+10}px;animation-duration:${dur}s;animation-delay:${delay}s;box-shadow:0 0 4px ${color};`;
    container.appendChild(p);
  }
}

/** Marca qué fighter tiene el turno activo (glow) */
function setActiveFighter(side) {
  const pf = document.getElementById('fighter-player');
  const ef = document.getElementById('fighter-enemy');
  if (!pf || !ef) return;
  pf.classList.remove('active-turn', 'enemy-active');
  ef.classList.remove('active-turn', 'enemy-active');
  if (side === 'player') pf.classList.add('active-turn');
  if (side === 'enemy')  ef.classList.add('enemy-active');
}

// =====================================================
// SAVE SYSTEM
// =====================================================

/** Guarda el progreso en localStorage */
function saveGame() {
  if (!player) return;
  const data = {
    player: JSON.parse(JSON.stringify(player)),
    wins: player.wins,
    gold: player.gold || 0,
    inventory: player.inventory || {},
    materials: player.materials || {},
    ts: Date.now()
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

/** Carga la partida guardada */
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Migrate: ensure gold and inventory exist
    if (data.player) {
      data.player.gold      = data.player.gold      ?? data.gold      ?? 0;
      data.player.inventory = data.player.inventory ?? data.inventory ?? {};
      data.player.materials = data.player.materials ?? data.materials ?? {};
    }
    return data;
  } catch (e) {
    console.error('Error al cargar save:', e);
    return null;
  }
}

/** Borra el save y reinicia la UI */
function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  player = null; enemy = null; battleState = null;
  document.getElementById('btn-continue').style.display = 'none';
  document.getElementById('btn-reset').style.display    = 'none';
  showScreen('title');
}

/** Comprueba si existe un save al cargar la página */
function checkExistingSave() {
  const data = loadGame();
  if (data && data.player) {
    document.getElementById('btn-continue').style.display = 'block';
    document.getElementById('btn-reset').style.display    = 'block';
  }
}

/** Carga la partida guardada y lleva al jugador a su perfil */
function continueGame() {
  const data = loadGame();
  if (!data) return;
  player = data.player;
  showScreen('hub');
}

/** Muestra confirmación antes de borrar */
function confirmReset() {
  showModal(
    '🗑️ Borrar progreso',
    '¿Seguro que quieres borrar toda tu partida? Esta acción es permanente.',
    '🗑️ Sí, borrar',
    () => { closeModal(); resetGame(); }
  );
}

// =====================================================
// SCREEN MANAGEMENT
// =====================================================

function showScreen(id) {
  // Victory and defeat are overlays, not screens
  if (id === 'victory' || id === 'defeat') {
    showOverlay(id);
    return;
  }
  // Stop hub particles if leaving hub
  if (id !== 'hub') stopHubParticles();

  // Hide any open overlay first
  document.querySelectorAll('.result-overlay').forEach(o => o.classList.remove('active'));
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + id);
  if (screen) screen.classList.add('active');

  // Screen-specific updates
  if (id === 'status'    && player) updateStatusScreen();
  if (id === 'hub'       && player) { updateHubScreen(); startBaseRegen(); }
  if (id === 'inventory' && player) { stopBaseRegen(); updateInventoryScreen(); }
  if (id === 'battle')              { stopBaseRegen(); }
  if (id === 'title')               { stopBaseRegen(); }
}

function showOverlay(id) {
  // Hide all overlays first, then show the right one
  document.querySelectorAll('.result-overlay').forEach(o => o.classList.remove('active'));
  const overlay = document.getElementById('screen-' + id);
  if (overlay) overlay.classList.add('active');
}

// =====================================================
// MODAL
// =====================================================

function showModal(title, body, confirmLabel, onConfirm) {
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-body').textContent    = body;
  const btn = document.getElementById('modal-confirm');
  btn.textContent = confirmLabel;
  btn.onclick = onConfirm;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// =====================================================
// CHARACTER CREATION
// =====================================================

function startNewGame() {
  // Si hay save, preguntar antes de sobreescribir
  const data = loadGame();
  if (data && data.player) {
    showModal(
      '⚠️ Nueva partida',
      'Ya tienes una partida guardada. ¿Quieres empezar de nuevo y perder ese progreso?',
      '▶ Nueva partida',
      () => { closeModal(); showScreen('create'); }
    );
  } else {
    showScreen('create');
  }
}

function createCharacter() {
  const name = document.getElementById('ninja-name').value.trim();
  if (!name) { alert('Ingresa un nombre para tu ninja'); return; }

  player = {
    name,
    class: null,          // null = Ninja Novato (sin clase hasta nivel 5)
    level: 1,
    xp: 0,
    gold: 0,
    stats: { ...BASE_STATS },
    currentHp: BASE_STATS.hp,
    currentSp: BASE_STATS.sp,
    healUses: 3,
    wins: 0
  };

  saveGame();
  document.getElementById('btn-continue').style.display = 'block';
  document.getElementById('btn-reset').style.display    = 'block';
  showScreen('hub');
}

// =====================================================
// CLASS SELECTION (desbloqueada a nivel 5)
// =====================================================

/** Muestra la pantalla de elección de clase */
function showClassSelection(afterCallback) {
  selectedClassKey = null;
  // Resetear selección visual
  ['sword','axe','hammer'].forEach(k => {
    document.getElementById('card-' + k).classList.remove('selected');
  });
  document.getElementById('btn-confirm-class').disabled = true;
  levelUpCallback = afterCallback; // guardamos para usar tras elegir
  showScreen('class');
}

function selectClass(cls) {
  selectedClassKey = cls;
  ['sword','axe','hammer'].forEach(k => {
    document.getElementById('card-' + k).classList.toggle('selected', k === cls);
  });
  document.getElementById('btn-confirm-class').disabled = false;
}

function confirmClass() {
  if (!selectedClassKey) return;
  player.class = selectedClassKey;
  saveGame();
  // Continuar con el flujo de level-up que llamó a la selección
  if (levelUpCallback) {
    const cb = levelUpCallback;
    levelUpCallback = null;
    cb();
  } else {
    showScreen('status');
  }
}

// =====================================================
// BATTLE SETUP
// =====================================================

function startBattle() {
  if (!player) return;
  document.querySelectorAll('.result-overlay').forEach(o => o.classList.remove('active'));
  stopHubParticles();

  // Restaurar recursos entre combates
  const hpRec = Math.floor(player.stats.hp * HP_RECOVERY_AFTER_BATTLE);
  const mpRec = Math.floor(player.stats.sp * MP_RECOVERY_AFTER_BATTLE);
  player.currentHp = Math.min(player.stats.hp, player.currentHp + hpRec);
  player.currentSp = Math.min(player.stats.sp, player.currentSp + mpRec);
  player.healUses  = 3;

  // Seleccionar enemigo según nivel del jugador
  const pool = ENEMIES.filter(e => e.tier <= player.level);
  const base = pool[Math.floor(Math.random() * pool.length)];
  const scale = 1 + (player.level - 1) * 0.22;

  enemy = {
    name: base.name,
    sprite: base.sprite,
    xpReward:   Math.floor(base.xp   + player.level * 8),
    goldReward: Math.floor(base.gold + player.level * 3),
    maxHp:  Math.floor(player.stats.hp  * base.hpM  * scale),
    atk:    Math.floor(player.stats.atk * base.atkM * scale),
    def:    Math.floor(player.stats.def * base.defM * scale),
    crit:   8,
    currentHp: 0,
    skillCooldown: 0
  };
  enemy.currentHp = enemy.maxHp;

  battleState = {
    playerTurn:      true,
    playerDefending: false,
    enemyDefending:  false,
    skillCooldown:   0,
    over:            false
  };

  renderBattleUI();
  setLog(`¡<span class="enemy-hl">${enemy.name}</span> aparece! Prepárate para combatir.`);
  enableActions(true);
  closeAllMenus();
  showScreen('battle');
}

// =====================================================
// BATTLE UI RENDER
// =====================================================

function renderBattleUI() {
  const clsName = player.class ? CLASSES[player.class].name : 'Ninja Novato';

  document.getElementById('b-player-name').textContent  = player.name;
  document.getElementById('b-player-name2').textContent = player.name;
  document.getElementById('b-player-level').textContent = `Lv.${player.level} · ${clsName}`;
  // Sprite jugador (siempre 🥷)
  document.getElementById('sprite-player').textContent = '🥷';
  document.getElementById('sprite-enemy').textContent  = enemy.sprite;
  document.getElementById('enemy-name').textContent    = enemy.name;
  const hdrEnemy = document.getElementById('b-header-enemy-name');
  if (hdrEnemy) hdrEnemy.textContent = enemy.name;

  // Nombre y costo de la skill según clase
  const skillLabel = player.class ? CLASSES[player.class].skillName : 'Jutsu';
  document.getElementById('skill-name-label').textContent = skillLabel;
  document.getElementById('skill-cost-label').textContent = '20 MP';

  updateBars();
}

/** Actualiza todas las barras de HP / MP / XP en pantalla de batalla */

// ── Submenú de Objetos ──
function toggleItemsSubmenu() {
  const sub = document.getElementById('items-submenu');
  const btn = document.querySelector('.items-toggle');
  if (!sub) return;
  const isOpen = sub.classList.contains('open');
  sub.classList.toggle('open', !isOpen);
  if (btn) btn.classList.toggle('open', !isOpen);
}

function closeItemsSubmenu() {
  const sub = document.getElementById('items-submenu');
  const btn = document.querySelector('.items-toggle');
  if (sub) sub.classList.remove('open');
  if (btn) btn.classList.remove('open');
}

// ── Actualiza cantidades de items en el menú Utilidad ──
function updateCombatItemsUI() {
  if (!player) return;
  const inv = player.inventory || {};

  const ITEM_KEYS = {
    'pocion-vida':  'qty-pocion-vida',
    'pocion-mayor': 'qty-pocion-mayor',
    'pocion-mana':  'qty-pocion-mana',
    'smoke-bomb':   'qty-smoke-bomb',
  };
  const BTN_KEYS = {
    'pocion-vida':  'btn-item-vida',
    'pocion-mayor': 'btn-item-mayor',
    'pocion-mana':  'btn-item-mana',
    'smoke-bomb':   'btn-item-smoke',
  };

  let totalItems = 0;
  for (const [key, qtyId] of Object.entries(ITEM_KEYS)) {
    const qty = inv[key] || 0;
    totalItems += qty;
    const qtyEl = document.getElementById(qtyId);
    if (qtyEl) {
      qtyEl.textContent = `×${qty}`;
      qtyEl.style.color = qty > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)';
    }
    const btnEl = document.getElementById(BTN_KEYS[key]);
    if (btnEl) btnEl.disabled = (qty <= 0);
  }

  // Contador total en el botón "Objetos"
  const totalEl = document.getElementById('items-total-count');
  if (totalEl) {
    totalEl.textContent = totalItems > 0 ? `×${totalItems}` : '×0';
    totalEl.style.color = totalItems > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)';
  }
}

function updateBars() {
  // HP jugador
  const hpPct = Math.max(0, player.currentHp / player.stats.hp * 100);
  document.getElementById('player-hp-bar').style.width = hpPct + '%';
  document.getElementById('player-hp-text').textContent =
    `${Math.max(0, player.currentHp)} / ${player.stats.hp}`;

  // MP jugador
  const spPct = Math.max(0, player.currentSp / player.stats.sp * 100);
  document.getElementById('player-sp-bar').style.width = spPct + '%';
  document.getElementById('player-sp-text').textContent =
    `${Math.max(0, player.currentSp)} / ${player.stats.sp}`;

  // HP enemigo
  const ehpPct = Math.max(0, enemy.currentHp / enemy.maxHp * 100);
  document.getElementById('enemy-hp-bar').style.width  = ehpPct + '%';
  document.getElementById('enemy-hp-text').textContent =
    `${Math.max(0, enemy.currentHp)} / ${enemy.maxHp}`;

  // XP progress
  const xpNeeded = getXpNeeded(player.level);
  const xpPrev   = getXpNeeded(player.level - 1);
  const xpRange  = xpNeeded - xpPrev;
  const xpPct    = player.level >= 20 ? 100 : Math.min(100, (player.xp - xpPrev) / xpRange * 100);
  document.getElementById('xp-bar').style.width = xpPct + '%';
  document.getElementById('xp-text').textContent = `${player.xp} / ${xpNeeded}`;

  // Indicador de turno
  const ti = document.getElementById('turn-indicator');
  if (battleState.playerTurn) {
    ti.textContent = 'TU TURNO';
    ti.className   = 'turn-indicator player-turn';
    setActiveFighter('player');
  } else {
    ti.textContent = 'ENEMIGO';
    ti.className   = 'turn-indicator enemy-turn';
    setActiveFighter('enemy');
  }

  // Etiquetas de botones
  // heal-uses-label vacío — curar es habilidad base sin contador visible

  // Skill deshabilitada si cooldown o sin MP
  const btnSkill = document.getElementById('btn-skill');
  const skillDesc = btnSkill.querySelector('.ma-desc');
  if (battleState.skillCooldown > 0) {
    skillDesc.textContent = `Cooldown: ${battleState.skillCooldown} turnos`;
    btnSkill.disabled = true;
  } else if (player.currentSp < 20) {
    skillDesc.textContent = 'Sin MP suficiente';
    btnSkill.disabled = true;
  } else {
    const skillLabel = player.class ? CLASSES[player.class].skillName : 'Jutsu';
    skillDesc.textContent = `${skillLabel} · ×1.8 daño`;
    btnSkill.disabled = false;
  }

  // Heal deshabilitado sin usos
  document.getElementById('btn-heal').disabled = player.healUses <= 0;
  updateCombatItemsUI();

  // Status effects
  renderStatusEffects();
}

function renderStatusEffects() {
  const row = document.getElementById('status-effects-row');
  row.innerHTML = '';
  if (battleState.playerDefending) {
    row.innerHTML += `<span class="status-effect defending">🛡️ DEFENDIENDO</span>`;
  }
}

function setLog(html) {
  document.getElementById('battle-log-text').innerHTML = html;
}

// ===== ACTION MENUS =====

function toggleMenu(menuId) {
  if (menuId !== 'menu-util') closeItemsSubmenu();
  const dropdown = document.getElementById(menuId);
  const isOpen   = dropdown.classList.contains('open');

  closeAllMenus();

  if (!isOpen) {
    dropdown.classList.add('open');
    const toggleId = menuId === 'menu-attack' ? 'toggle-attack' : 'toggle-util';
    document.getElementById(toggleId).classList.add('open');
    document.getElementById('arrow-' + (menuId === 'menu-attack' ? 'attack' : 'util')).style.transform = 'rotate(180deg)';
    // Mostrar backdrop para cerrar al tocar fuera
    const bd = document.getElementById('menu-backdrop');
    if (bd) bd.classList.add('active');
  }
}

function closeAllMenus() {
  closeItemsSubmenu();
  ['menu-attack','menu-util'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
  ['toggle-attack','toggle-util'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
  const aa = document.getElementById('arrow-attack');
  const au = document.getElementById('arrow-util');
  if (aa) aa.style.transform = '';
  if (au) au.style.transform = '';
  // Ocultar backdrop
  const bd = document.getElementById('menu-backdrop');
  if (bd) bd.classList.remove('active');
}

function enableActions(on) {
  const toggles = ['toggle-attack', 'toggle-util'];
  toggles.forEach(id => { document.getElementById(id).disabled = !on; });

  if (!on) {
    ['btn-attack','btn-skill','btn-defend','btn-heal'].forEach(id => {
      document.getElementById(id).disabled = true;
    });
  } else {
    document.getElementById('btn-attack').disabled  = false;
    document.getElementById('btn-defend').disabled  = false;
    document.getElementById('btn-heal').disabled    = player.healUses <= 0;
    // skill se actualiza en updateBars
    updateBars();
  }
}

// =====================================================
// COMBAT CALCULATIONS
// =====================================================

function calcDamage(atk, def, critPct, isSkill = false) {
  const base    = Math.max(1, atk - Math.floor(def * 0.55));
  const mult    = isSkill ? 1.8 : 1;
  const variance = 0.85 + Math.random() * 0.3;
  const isCrit  = Math.random() * 100 < critPct;
  const dmg     = Math.floor(base * mult * variance * (isCrit ? 2 : 1));
  return { dmg, isCrit };
}

function dodgeRoll(dodgePct) {
  return Math.random() * 100 < dodgePct;
}

/** Muestra número de daño / curación flotante en la arena */
function spawnDmgText(fighterId, text, color) {
  const arena = document.getElementById('battle-arena');
  const span  = document.createElement('div');
  span.className = 'dmg-text';
  span.textContent = text;
  span.style.color    = color;
  span.style.fontSize = text.length > 5 ? '17px' : '23px';
  span.style.top      = '30px';
  // Posicionar según quién recibe el golpe
  if (fighterId === 'fighter-player') {
    span.style.left = '22px';
  } else {
    span.style.right = '22px';
  }
  arena.appendChild(span);
  setTimeout(() => span.remove(), 1400);
}

/** Reproduce un spritesheet effect sobre un fighter
 *  target: 'fighter-player' | 'fighter-enemy'
 *  type:   'explosion' | 'heal'
 */
function spawnEffect(target, type) {
  const arena = document.getElementById('battle-arena');
  if (!arena) return;

  const fighter = document.getElementById(target);
  const el = document.createElement('div');
  el.className = `sprite-effect effect-${type}`;

  // Centrar sobre el fighter
  const arenaRect   = arena.getBoundingClientRect();
  const fighterRect = fighter ? fighter.getBoundingClientRect() : arenaRect;

  const offsetLeft = (fighterRect.left - arenaRect.left) + (fighterRect.width  / 2) - 96;
  const offsetTop  = (fighterRect.top  - arenaRect.top)  + (fighterRect.height / 2) - 96;

  el.style.left = offsetLeft + 'px';
  el.style.top  = offsetTop  + 'px';

  arena.appendChild(el);

  // Duración: explosion 480ms, heal 660ms
  const dur = type === 'explosion' ? 520 : 700;
  setTimeout(() => el.remove(), dur);
}

function animateSprite(spriteId, animClass) {
  const el = document.getElementById(spriteId);
  el.classList.remove('attack-anim','hit-anim','shake-anim','crit-anim');
  void el.offsetWidth; // force reflow
  el.classList.add(animClass);
  setTimeout(() => el.classList.remove(animClass), 500);
}

// =====================================================
// PLAYER ACTIONS
// =====================================================

function playerAction(action) {
  if (!battleState.playerTurn || battleState.over) return;

  enableActions(false);
  closeAllMenus();
  battleState.playerDefending = false;

  switch (action) {
    case 'attack': doPlayerAttack(false); break;
    case 'skill':
      if (battleState.skillCooldown > 0 || player.currentSp < 20) {
        enableActions(true); return;
      }
      doPlayerAttack(true);
      break;
    case 'defend':
      battleState.playerDefending = true;
      setLog(`<span class="highlight">${player.name}</span> adopta postura defensiva. El daño recibido se reduce un <span class="mp-hl">50%</span>.`);
      animateSprite('sprite-player', 'hit-anim');
      setTimeout(endPlayerTurn, 600);
      break;
    case 'heal':
      // healUses reemplazado por sistema de inventario — usar useCombatItem()
  if (player.healUses <= 0) { enableActions(true); return; }
      doHeal();
      break;
  }
}

function doPlayerAttack(isSkill) {
  if (isSkill) {
    player.currentSp -= 20;
    battleState.skillCooldown = 3;
  }

  // Chequeo de esquiva enemiga (usa DEF como proxy de esquiva base)
  if (dodgeRoll(enemy.def * 0.18)) {
    setLog(`¡<span class="enemy-hl">${enemy.name}</span> esquivó el ataque!`);
    animateSprite('sprite-player', 'attack-anim');
    spawnDmgText('fighter-enemy', 'MISS', '#8b949e');
    setTimeout(endPlayerTurn, 700);
    return;
  }

  const { dmg, isCrit } = calcDamage(player.stats.atk, enemy.def, player.stats.crit, isSkill);
  enemy.currentHp -= dmg;

  const skillLabel = player.class ? CLASSES[player.class].skillName : 'Jutsu';
  const actionStr  = isSkill
    ? `usa <span class="skill-hl">${skillLabel}</span> y causa`
    : 'ataca y causa';
  const critBadge  = isCrit ? ' <span class="badge crit">¡CRÍTICO!</span>' : '';

  setLog(`<span class="highlight">${player.name}</span> ${actionStr} <span class="damage">${dmg} daño</span>${critBadge}`);

  animateSprite('sprite-player', 'attack-anim');
  if (isSkill) spawnEffect('fighter-enemy', 'explosion');
  setTimeout(() => {
    animateSprite('sprite-enemy', isCrit ? 'crit-anim' : 'hit-anim');
    spawnDmgText('fighter-enemy', isCrit ? `💥${dmg}` : `${dmg}`, isCrit ? '#ffd700' : '#e74c3c');
    updateBars();
    if (enemy.currentHp <= 0) {
      setTimeout(victory, 600);
    } else {
      setTimeout(endPlayerTurn, 500);
    }
  }, 300);
}

function doHeal() {
  player.healUses--;
  const healAmt = Math.floor(player.stats.hp * 0.25);
  player.currentHp = Math.min(player.stats.hp, player.currentHp + healAmt);

  setLog(`<span class="highlight">${player.name}</span> usa curación y recupera <span class="heal-hl">+${healAmt} HP</span>`);
  animateSprite('sprite-player', 'hit-anim');
  spawnEffect('fighter-player', 'heal');
  spawnDmgText('fighter-player', `+${healAmt}HP`, '#2ecc71');
  updateBars();
  setTimeout(endPlayerTurn, 700);
}

// ===== MP REGEN END OF PLAYER TURN =====

function endPlayerTurn() {
  // Sin regeneración automática de MP en combate
  // (gestión de recursos es responsabilidad del jugador)
  battleState.playerTurn = false;
  if (battleState.skillCooldown > 0) battleState.skillCooldown--;
  updateBars();
  setTimeout(enemyTurn, 850);
}

// regenMP() eliminado — MP ya no se regenera en combate.
// Ver: startBaseRegen() para regeneración en Base Ninja.


// =====================================================
// SISTEMA DE REGENERACIÓN — BASE NINJA
// =====================================================
// El jugador regenera HP y MP lentamente solo en la
// Base Ninja. Cada tick = BASE_REGEN_INTERVAL_MS ms.
// El efecto visual de curación aparece periódicamente.
// =====================================================

let _baseRegenTimer   = null;   // intervalo activo
let _regenEffectCount = 0;      // contador para espaciar el visual


// ── Actualiza el indicador de estado de regeneración ──
// Llamar desde: updateHubScreen, updateHubRegenDisplay, stopBaseRegen
function updateRegenStatus() {
  const regenEl = document.getElementById('hub-regen-status');
  if (!regenEl || !player) return;

  const isFullHp = player.currentHp >= player.stats.hp;
  const isFullMp = player.currentSp >= player.stats.sp;
  const isFull   = isFullHp && isFullMp;

  if (isFull) {
    // Ya recuperado — badge verde con fade-in
    regenEl.innerHTML = '<span class="hub-regen-full">✔ Recuperado</span>';
  } else {
    // Calculamos cuánto falta (útil para futura barra de progreso)
    const hpMissing = player.stats.hp  - player.currentHp;
    const mpMissing = player.stats.sp  - player.currentSp;
    const totalSecs = Math.ceil((hpMissing + mpMissing) * BASE_REGEN_INTERVAL_MS / 1000);
    regenEl.innerHTML = `<span class="hub-regen-indicator">⚕ Recuperando...</span>`;
  }
}

/** Inicia la regeneración pasiva en la Base Ninja */
function startBaseRegen() {
  stopBaseRegen(); // limpiar timer anterior si existía

  // Solo regenerar si el jugador no está al máximo
  if (!player) return;
  if (player.currentHp >= player.stats.hp &&
      player.currentSp >= player.stats.sp) {
    updateHubRegenDisplay();
    return;
  }

  _baseRegenTimer = setInterval(() => {
    if (!player) { stopBaseRegen(); return; }

    const wasHpFull = player.currentHp >= player.stats.hp;
    const wasMpFull = player.currentSp >= player.stats.sp;

    // Aplicar tick
    let hpGained = 0, mpGained = 0;
    if (!wasHpFull) {
      const prev = player.currentHp;
      player.currentHp = Math.min(player.stats.hp, player.currentHp + BASE_REGEN_HP_PER_TICK);
      hpGained = player.currentHp - prev;
    }
    if (!wasMpFull) {
      const prev = player.currentSp;
      player.currentSp = Math.min(player.stats.sp, player.currentSp + BASE_REGEN_MP_PER_TICK);
      mpGained = player.currentSp - prev;
    }

    // Actualizar UI del Hub
    updateHubRegenDisplay();

    // Efecto visual cada 4 ticks para no saturar
    _regenEffectCount++;
    if (_regenEffectCount % 4 === 0) {
      playHubHealEffect();
    }

    // Partícula de texto flotante en el avatar
    if (hpGained > 0) showHubRegenTick(`+${hpGained}`, '#2ecc71');
    if (mpGained > 0) showHubRegenTick(`+${mpGained}`, '#3498db');

    // Guardar progreso silenciosamente cada 10 ticks
    if (_regenEffectCount % 10 === 0) saveGame();

    // Detener si ya está full
    if (player.currentHp >= player.stats.hp &&
        player.currentSp >= player.stats.sp) {
      stopBaseRegen();
      updateRegenStatus(); // cambia a "✔ Recuperado"
      playHubHealEffect(); // efecto visual final
      showHubRegenTick('✨', '#ffd700');
      saveGame();
    }
  }, BASE_REGEN_INTERVAL_MS);
}

/** Detiene la regeneración en Base */
function stopBaseRegen() {
  if (_baseRegenTimer) {
    clearInterval(_baseRegenTimer);
    _baseRegenTimer = null;
  }
  _regenEffectCount = 0;
}

/** Actualiza barras HP/MP del Hub en tiempo real */
function updateHubRegenDisplay() {
  if (!player) return;
  const hpPct = Math.round((player.currentHp / player.stats.hp) * 100);
  const mpPct = Math.round((player.currentSp / player.stats.sp) * 100);

  const hpBar = document.getElementById('hub-hp-bar');
  const mpBar = document.getElementById('hub-mp-bar');
  const hpVal = document.getElementById('hub-hp-val');
  const mpVal = document.getElementById('hub-mp-val');

  if (hpBar) hpBar.style.width = Math.min(hpPct, 100) + '%';
  if (mpBar) mpBar.style.width = Math.min(mpPct, 100) + '%';
  if (hpVal) hpVal.textContent = `${player.currentHp}/${player.stats.hp}`;
  if (mpVal) mpVal.textContent = `${player.currentSp}/${player.stats.sp}`;

  // Actualizar indicador de estado
  updateRegenStatus();
}

/** Muestra número flotante sobre el avatar en el Hub */
function showHubRegenTick(text, color) {
  const avatar = document.querySelector('#screen-hub .hub-avatar');
  if (!avatar) return;
  const el = document.createElement('div');
  el.style.cssText = `
    position:absolute;
    bottom:70px;
    left:50%;
    transform:translateX(-50%);
    font-family:'Cinzel',serif;
    font-size:13px;
    font-weight:700;
    color:${color};
    pointer-events:none;
    text-shadow:0 0 8px ${color};
    animation:hubTickFloat 1.2s ease forwards;
    z-index:10;
    white-space:nowrap;
  `;
  el.textContent = text;
  avatar.style.position = 'relative';
  avatar.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/** Reproduce el spritesheet de heal sobre el avatar del Hub */
function playHubHealEffect() {
  const avatarWrap = document.querySelector('#screen-hub .hub-avatar');
  if (!avatarWrap) return;

  // Evitar apilar múltiples efectos
  if (avatarWrap.querySelector('.hub-heal-effect')) return;

  const el = document.createElement('div');
  el.className = 'hub-heal-effect';
  avatarWrap.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// =====================================================
// SISTEMA DE DROPS DE CRAFTEO (estructura preparada)
// =====================================================
// Activar cuando CRAFT_DROP_SYSTEM_ENABLED = true
// Cada enemigo puede tener: drops: [{ item, chance }]
// =====================================================

// =====================================================
// MATERIALES — catálogo completo
// Agregar nuevos materiales aquí para futuras expansiones
// =====================================================
const CRAFT_ITEMS = {
  hierba:          { name: 'Hierba medicinal', icon: '🌿', rarity: 'común'    },
  hongo:           { name: 'Hongo nocturno',   icon: '🍄', rarity: 'común'    },
  flor_lunar:      { name: 'Flor lunar',       icon: '🌸', rarity: 'poco común'},
  esencia_liquida: { name: 'Esencia líquida',  icon: '💧', rarity: 'común'    },
  esencia_eterea:  { name: 'Esencia etérea',   icon: '💨', rarity: 'poco común'},
  esencia_oscura:  { name: 'Esencia oscura',   icon: '☠️', rarity: 'raro'     },
  fragmento_astral:{ name: 'Fragmento astral', icon: '🌀', rarity: 'épico'    },
};

// =====================================================
// DROPS POR ENEMIGO
// chance: 0.0–1.0 por material
// =====================================================
// =====================================================
// DROPS POR ENEMIGO — balance oficial
// =====================================================
const ENEMY_DROPS = {
  'Rata Ninja': [
    { item: 'hierba',          chance: 0.45 },
    { item: 'hongo',           chance: 0.35 },
  ],
  'Murciélago Oscuro': [
    { item: 'hierba',          chance: 0.45 },
    { item: 'esencia_liquida', chance: 0.40 },
    { item: 'esencia_eterea',  chance: 0.12 },
  ],
  'Demonio Oni': [
    { item: 'hongo',           chance: 0.35 },
    { item: 'esencia_liquida', chance: 0.40 },
    { item: 'flor_lunar',      chance: 0.18 },
    { item: 'esencia_oscura',  chance: 0.05 },
  ],
  'Berserker Furioso': [
    { item: 'hierba',          chance: 0.45 },
    { item: 'flor_lunar',      chance: 0.18 },
    { item: 'esencia_eterea',  chance: 0.12 },
    { item: 'esencia_oscura',  chance: 0.05 },
  ],
  'Guerrero Maldito': [
    { item: 'esencia_liquida', chance: 0.40 },
    { item: 'flor_lunar',      chance: 0.18 },
    { item: 'esencia_eterea',  chance: 0.12 },
    { item: 'esencia_oscura',  chance: 0.05 },
    { item: 'fragmento_astral',chance: 0.01 },
  ],
  'Gran Demonio': [
    { item: 'esencia_oscura',  chance: 0.05 },
    { item: 'esencia_eterea',  chance: 0.12 },
    { item: 'flor_lunar',      chance: 0.18 },
    { item: 'fragmento_astral',chance: 0.01 },
  ],
};

// =====================================================
// RECETAS DE CRAFTING
// Escalable: agregar nuevas recetas aquí
// =====================================================
// =====================================================
// RECETAS DE CRAFTING — fuente única de consumibles
// =====================================================
const CRAFT_RECIPES = [
  {
    id: 'pocion_vida',
    name: 'Poción de Vida',
    icon: '🧪',
    desc: 'Restaura 25 HP',
    type: 'hp',
    effect: { hp: 25 },
    cost_gold: 15,
    materials: { hierba: 2, hongo: 1 },
    result_item: 'pocion-vida',
    color: 'rgba(255,71,87,0.12)',
    border: 'rgba(255,71,87,0.35)',
  },
  {
    id: 'pocion_mayor',
    name: 'Poción Mayor',
    icon: '⚗️',
    desc: 'Restaura 60 HP',
    type: 'hp',
    effect: { hp: 60 },
    cost_gold: 45,
    materials: { hierba: 3, flor_lunar: 2, esencia_oscura: 1 },
    result_item: 'pocion-mayor',
    color: 'rgba(255,71,87,0.12)',
    border: 'rgba(255,100,50,0.35)',
  },
  {
    id: 'pocion_mana',
    name: 'Poción de Maná',
    icon: '💙',
    desc: 'Recupera 30 MP',
    type: 'mp',
    effect: { mp: 30 },
    cost_gold: 20,
    materials: { esencia_liquida: 2, esencia_eterea: 1 },
    result_item: 'pocion-mana',
    color: 'rgba(0,212,255,0.10)',
    border: 'rgba(0,212,255,0.35)',
  },
  {
    id: 'smoke_bomb',
    name: 'Bomba de Humo',
    icon: '💨',
    desc: 'Escapa del combate (sin XP, oro ni drops)',
    type: 'utility',
    effect: { escape: true },
    cost_gold: 60,
    materials: { esencia_oscura: 2, esencia_eterea: 2 },
    result_item: 'smoke-bomb',
    color: 'rgba(80,80,120,0.12)',
    border: 'rgba(150,150,220,0.35)',
  },
];

// Mapa rápido de consumibles para usar en combate
const CONSUMABLE_ITEMS = {
  'pocion-vida':  { name: 'Poción de Vida',  icon: '🧪', hp: 25,  mp: 0,   escape: false },
  'pocion-mayor': { name: 'Poción Mayor',    icon: '⚗️', hp: 60,  mp: 0,   escape: false },
  'pocion-mana':  { name: 'Poción de Maná',  icon: '💙', hp: 0,   mp: 30,  escape: false },
  'smoke-bomb':   { name: 'Bomba de Humo',   icon: '💨', hp: 0,   mp: 0,   escape: true  },
};

/** Procesa drops de materiales al vencer un enemigo
 *  Usa la tabla ENEMY_DROPS indexada por nombre de enemigo
 *  Devuelve array de { icon, name } para mostrar en UI
 */
function processCraftDrops(enemyName) {
  if (!CRAFT_DROP_SYSTEM_ENABLED) return [];
  player.materials = player.materials || {};

  const dropTable = ENEMY_DROPS[enemyName] || [];
  const obtained  = [];

  for (const drop of dropTable) {
    if (Math.random() < drop.chance) {
      player.materials[drop.item] = (player.materials[drop.item] || 0) + 1;
      obtained.push(CRAFT_ITEMS[drop.item]);
    }
  }
  return obtained;
}

/** Muestra los drops obtenidos en el panel de victoria */
function showDropsInVictory(drops) {
  const el = document.getElementById('v-drops');
  if (!el) return;
  if (!drops.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="drops-label">Materiales obtenidos</div>
    <div class="drops-list">
      ${drops.map(d => `<span class="drop-badge">${d.icon} ${d.name}</span>`).join('')}
    </div>`;
}

// =====================================================
// ENEMY TURN (IA simple)
// =====================================================

function enemyTurn() {
  if (battleState.over) return;

  const roll     = Math.random();
  const useSkill = roll > 0.78 && enemy.skillCooldown === 0;
  const defend   = roll < 0.08;

  if (defend) {
    battleState.enemyDefending = true;
    setLog(`<span class="enemy-hl">${enemy.name}</span> se pone en guardia.`);
    animateSprite('sprite-enemy', 'hit-anim');
    setTimeout(endEnemyTurn, 700);
    return;
  }

  battleState.enemyDefending = false;

  // Chequeo de esquiva del jugador
  if (dodgeRoll(player.stats.dodge)) {
    setLog(`¡<span class="highlight">${player.name}</span> esquivó el ataque!`);
    animateSprite('sprite-enemy', 'attack-anim');
    spawnDmgText('fighter-player', 'DODGE!', '#9b59b6');
    setTimeout(endEnemyTurn, 700);
    return;
  }

  const { dmg, isCrit } = calcDamage(enemy.atk, player.stats.def, enemy.crit, useSkill);
  const finalDmg = battleState.playerDefending ? Math.floor(dmg * 0.5) : dmg;

  player.currentHp -= finalDmg;
  if (useSkill) enemy.skillCooldown = 3;

  const atkStr   = useSkill ? '<span class="skill-hl">¡Ataque especial!</span>' : 'ataca';
  const critBadge = isCrit ? ' <span class="badge crit">¡CRÍTICO!</span>' : '';
  const defStr    = battleState.playerDefending ? ' <span class="badge def">(bloqueado)</span>' : '';

  setLog(`<span class="enemy-hl">${enemy.name}</span> ${atkStr} por <span class="damage">${finalDmg} daño</span>${defStr}${critBadge}`);

  animateSprite('sprite-enemy', 'attack-anim');
  setTimeout(() => {
    animateSprite('sprite-player', isCrit ? 'shake-anim' : 'hit-anim');
    spawnDmgText('fighter-player', isCrit ? `💥${finalDmg}` : `${finalDmg}`, isCrit ? '#ffd700' : '#ff6b35');
    updateBars();
    if (player.currentHp <= 0) {
      setTimeout(defeat, 600);
    } else {
      setTimeout(endEnemyTurn, 500);
    }
  }, 300);
}

function endEnemyTurn() {
  if (enemy.skillCooldown > 0) enemy.skillCooldown--;
  battleState.playerTurn   = true;
  battleState.playerDefending = false;
  updateBars();
  enableActions(true);
}

// =====================================================
// VICTORY / DEFEAT
// =====================================================

function victory() {
  battleState.over = true;
  enableActions(false);
  closeAllMenus();

  const xpGained   = enemy.xpReward;
  const goldGained  = enemy.goldReward || 10;
  player.xp   += xpGained;
  player.gold  = (player.gold || 0) + goldGained;
  player.wins  = (player.wins || 0) + 1;

  // Procesar drops de materiales
  const drops = processCraftDrops(enemy.name);
  setTimeout(() => showDropsInVictory(drops), 100);

  // Sin recuperación automática — el jugador regenera en la Base Ninja
  setRecoveryPanel('victory-recovery', 0, 0, true);

  document.getElementById('v-enemy-name').textContent = enemy.name;
  document.getElementById('v-xp').textContent         = `+${xpGained} XP`;
  document.getElementById('v-gold').textContent       = `+${goldGained} 💰`;
  document.getElementById('v-level').textContent      = `Nivel ${player.level}`;

  // Procesar level-ups antes de mostrar pantalla
  checkLevelUp(() => {
    saveGame();
    showScreen('victory');
  // Hub will refresh when player returns
  });
}

function defeat() {
  battleState.over = true;
  enableActions(false);
  closeAllMenus();

  // Sin recuperación automática — el jugador regenera en la Base Ninja
  setRecoveryPanel('defeat-recovery', 0, 0, false);

  document.getElementById('d-enemy-name').textContent = enemy.name;
  document.getElementById('d-level').textContent      = player.level;

  saveGame();
  showScreen('defeat');
}

function respawn() {
  document.querySelectorAll('.result-overlay').forEach(o => o.classList.remove('active'));
  showScreen('hub');
}

/** Panel post-combate — muestra estado actual y mensaje de base */
function setRecoveryPanel(panelId, hpRec, mpRec, isVictory = true) {
  const hpPct = Math.round((player.currentHp / player.stats.hp) * 100);
  const mpPct = Math.round((player.currentSp / player.stats.sp) * 100);
  const hpColor = hpPct > 50 ? '#2ecc71' : hpPct > 25 ? '#f39c12' : '#e74c3c';
  const msg = isVictory
    ? '⛩️ Regresa a la Base para recuperarte'
    : '💀 Regresa a la Base y descansa';
  document.getElementById(panelId).innerHTML = `
    <div class="rec-status-row">
      <span style="color:#e74c3c">❤️ ${player.currentHp}/${player.stats.hp}</span>
      <span style="color:#3498db">💧 ${player.currentSp}/${player.stats.sp}</span>
    </div>
    <div class="rec-hint">${msg}</div>
  `;
}

// =====================================================
// LEVEL UP SYSTEM
// =====================================================

function getXpNeeded(level) {
  if (level <= 0) return 0;
  if (level < XP_TABLE.length) return XP_TABLE[level];
  // Escala lineal para niveles más allá de la tabla
  return XP_TABLE[XP_TABLE.length - 1] + (level - XP_TABLE.length + 1) * 600;
}

/** Comprueba cuántos niveles debe subir y los encola */
function checkLevelUp(callback) {
  pendingLevelUps = [];
  let lvl = player.level;
  while (player.xp >= getXpNeeded(lvl) && lvl < 20) {
    lvl++;
    pendingLevelUps.push(lvl);
  }

  if (pendingLevelUps.length > 0) {
    processNextLevelUp(callback);
  } else {
    callback();
  }
}

function processNextLevelUp(callback) {
  if (pendingLevelUps.length === 0) { callback(); return; }

  const newLevel = pendingLevelUps.shift();
  player.level   = newLevel;

  // ── Si el jugador llega a nivel 5 sin clase → elegir clase primero ──
  if (newLevel === 5 && !player.class) {
    saveGame();
    showClassSelection(() => {
      // Tras elegir clase, aplicar bonuses y mostrar level-up UI
      applyClassBonusesAndShowLevelUp(newLevel, callback);
    });
    return;
  }

  applyClassBonusesAndShowLevelUp(newLevel, callback);
}

function applyClassBonusesAndShowLevelUp(newLevel, callback) {
  const autoApplied = {};

  // Solo aplicar bonuses automáticos si ya tiene clase
  if (player.class) {
    const bonuses = CLASSES[player.class].bonuses;
    Object.entries(bonuses).forEach(([stat, val]) => {
      player.stats[stat] = parseFloat((player.stats[stat] + val).toFixed(2));
      autoApplied[stat]  = val;
    });
    // Si se ganó HP máximo, subir HP actual proporcionalmente
    if (bonuses.hp) {
      player.currentHp = Math.min(player.stats.hp, player.currentHp + bonuses.hp);
    }
  }

  showLevelUpScreen(newLevel, autoApplied, () => processNextLevelUp(callback));
}

// ===== LEVEL UP SCREEN =====

function showLevelUpScreen(level, autoBonuses, next) {
  currentLevelUpAlloc = {};
  STAT_CONFIG.forEach(s => { currentLevelUpAlloc[s.key] = 0; });

  document.getElementById('lu-level-text').textContent   = `Nivel ${level} alcanzado`;
  document.getElementById('pts-remaining').textContent   = '3';
  document.getElementById('btn-confirm-levelup').disabled = true;
  document.getElementById('btn-confirm-levelup').textContent = 'Distribuye todos los puntos (3 restantes)';

  // Bonus automáticos
  const bonusList = document.getElementById('auto-bonus-list');
  bonusList.innerHTML = '';

  if (Object.keys(autoBonuses).length === 0) {
    bonusList.innerHTML = '<span style="font-size:12px;color:var(--text2)">Elige tu clase para obtener bonuses automáticos.</span>';
  } else {
    Object.entries(autoBonuses).forEach(([stat, val]) => {
      const labels = { hp:'HP', sp:'MP', atk:'ATK', def:'DEF', spd:'SPD', crit:'CRIT', dodge:'Dodge' };
      const suffix = (stat === 'crit' || stat === 'dodge') ? '%' : '';
      const div = document.createElement('div');
      div.className   = 'auto-bonus-item';
      div.textContent = `+${val}${suffix} ${labels[stat] || stat}`;
      bonusList.appendChild(div);
    });
  }

  // Filas de asignación de stats
  const allocContainer = document.getElementById('stat-allocate');
  allocContainer.innerHTML = '';
  STAT_CONFIG.forEach(cfg => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-icon">${cfg.icon}</span>
      <div style="flex:1">
        <div class="stat-name">${cfg.label}</div>
        <div class="stat-gain">${cfg.desc}</div>
      </div>
      <div class="stat-controls">
        <button class="stat-btn minus" onclick="allocate('${cfg.key}',-1)" id="minus-${cfg.key}">−</button>
        <span class="stat-allocated" id="alloc-${cfg.key}">0</span>
        <button class="stat-btn plus"  onclick="allocate('${cfg.key}',1)"  id="plus-${cfg.key}">+</button>
      </div>
    `;
    allocContainer.appendChild(row);
  });

  levelUpCallback = next;
  showScreen('levelup');
}

function allocate(stat, delta) {
  const total = Object.values(currentLevelUpAlloc).reduce((a, b) => a + b, 0);
  if (delta > 0 && total >= 3) return;
  if (delta < 0 && currentLevelUpAlloc[stat] <= 0) return;

  currentLevelUpAlloc[stat] = (currentLevelUpAlloc[stat] || 0) + delta;
  const remaining = 3 - Object.values(currentLevelUpAlloc).reduce((a, b) => a + b, 0);

  document.getElementById(`alloc-${stat}`).textContent = currentLevelUpAlloc[stat];
  document.getElementById('pts-remaining').textContent  = remaining;

  const btn = document.getElementById('btn-confirm-levelup');
  if (remaining === 0) {
    btn.disabled    = false;
    btn.textContent = '✓ Confirmar y continuar';
  } else {
    btn.disabled    = true;
    btn.textContent = `Distribuye todos los puntos (${remaining} restantes)`;
  }

  // Actualizar estado de botones +/-
  STAT_CONFIG.forEach(cfg => {
    document.getElementById(`plus-${cfg.key}`).disabled  = remaining === 0;
    document.getElementById(`minus-${cfg.key}`).disabled = currentLevelUpAlloc[cfg.key] <= 0;
  });
}

function confirmLevelUp() {
  const total = Object.values(currentLevelUpAlloc).reduce((a, b) => a + b, 0);
  if (total < 3) return;

  // Aplicar puntos asignados
  STAT_CONFIG.forEach(cfg => {
    const pts = currentLevelUpAlloc[cfg.key] || 0;
    if (pts > 0) {
      Object.entries(cfg.gain).forEach(([stat, val]) => {
        player.stats[stat] = parseFloat((player.stats[stat] + val * pts).toFixed(2));
      });
    }
  });

  // Si subió HP máximo, también subir HP actual
  if (currentLevelUpAlloc.hp > 0) {
    player.currentHp = Math.min(player.stats.hp, player.currentHp + currentLevelUpAlloc.hp * 10);
  }

  saveGame();
  if (levelUpCallback) {
    const cb = levelUpCallback;
    levelUpCallback = null;
    cb();
  }
}

// =====================================================
// STATUS / PROFILE SCREEN
// =====================================================

function updateStatusScreen() {
  if (!player) return;

  const clsName = player.class ? CLASSES[player.class].name : 'Ninja Novato';

  document.getElementById('st-sprite').textContent = '🥷';
  document.getElementById('st-name').textContent   = player.name;
  document.getElementById('st-class').textContent  = clsName;
  document.getElementById('st-level').textContent  = `⚡ Nivel ${player.level}`;
  document.getElementById('st-wins').textContent   = player.wins || 0;
  document.getElementById('st-wins2').textContent  = player.wins || 0;

  // ── RECURSOS con barras animadas ──
  const hpPct = Math.max(0, player.currentHp / player.stats.hp * 100);
  const mpPct = Math.max(0, player.currentSp / player.stats.sp * 100);

  const xpNeeded = getXpNeeded(player.level);
  const xpPrev   = getXpNeeded(player.level - 1);
  const xpRange  = xpNeeded - xpPrev;
  const xpPct    = player.level >= 20 ? 100 : Math.min(100, (player.xp - xpPrev) / xpRange * 100);

  // HP
  document.getElementById('st-hp-cur').textContent     = Math.max(0, player.currentHp);
  document.getElementById('st-hp-max').textContent     = player.stats.hp;
  document.getElementById('st-hp-bar').style.width     = hpPct + '%';

  // MP
  document.getElementById('st-mp-cur').textContent     = Math.max(0, player.currentSp);
  document.getElementById('st-mp-max').textContent     = player.stats.sp;
  document.getElementById('st-mp-bar').style.width     = mpPct + '%';

  // XP
  document.getElementById('st-xp-cur').textContent     = player.xp;
  document.getElementById('st-xp-max').textContent     = xpNeeded;
  document.getElementById('st-xp-bar').style.width     = xpPct + '%';

  // ── STATS ──
  setStatCard('st-atk',   player.stats.atk);
  setStatCard('st-def',   player.stats.def);
  setStatCard('st-spd',   player.stats.spd);
  setStatCard('st-crit',  player.stats.crit.toFixed(1) + '%');
  setStatCard('st-dodge', player.stats.dodge.toFixed(1) + '%');
}

/** Actualiza el valor de un stat-card con animación de glow */
function setStatCard(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = el.textContent;
  el.textContent = value;
  if (prev !== String(value)) {
    el.closest('.stat-card').classList.remove('stat-updated');
    void el.offsetWidth;
    el.closest('.stat-card').classList.add('stat-updated');
    setTimeout(() => el.closest('.stat-card').classList.remove('stat-updated'), 800);
  }
}

// =====================================================
// HOME HUB
// =====================================================

const HUB_TIPS = [
  "Las sombras favorecen a los pacientes.",
  "Un ninja que ataca primero, a veces pierde primero.",
  "El silencio es tu armadura más poderosa.",
  "Conoce a tu enemigo antes de desenvainar.",
  "La velocidad sin precisión es solo ruido.",
  "El verdadero ninja no busca la batalla, la termina.",
  "Cada derrota es una lección disfrazada.",
  "El chi fluye donde la mente va."
];

function getRankInfo(wins) {
  if (wins >= 50) return { icon: "👹", label: "Leyenda" };
  if (wins >= 20) return { icon: "🔥", label: "Maestro" };
  if (wins >= 10) return { icon: "⚔️", label: "Veterano" };
  if (wins >= 5)  return { icon: "🗡️", label: "Guerrero" };
  return { icon: "🥋", label: "Aprendiz" };
}

function updateHubScreen() {
  if (!player) return;

  // Name, class, level
  document.getElementById('hub-name').textContent  = player.name;
  document.getElementById('hub-level').textContent = player.level;

  const CLASS_NAMES = { sword: 'Espadachín', axe: 'Berserker', hammer: 'Titán' };
  document.getElementById('hub-class').textContent =
    player.class ? CLASS_NAMES[player.class] || 'Ninja Novato' : 'Ninja Novato';

  // HP bar
  const hpPct = Math.round((player.currentHp / player.stats.hp) * 100);
  document.getElementById('hub-hp-bar').style.width = hpPct + '%';
  document.getElementById('hub-hp-val').textContent = player.currentHp + '/' + player.stats.hp;

  // MP bar
  const mpPct = Math.round((player.currentSp / player.stats.sp) * 100);
  document.getElementById('hub-mp-bar').style.width = mpPct + '%';
  document.getElementById('hub-mp-val').textContent = player.currentSp + '/' + player.stats.sp;

  // XP bar
  const xpNeeded = player.level * 100;
  const xpPct = Math.round((player.xp / xpNeeded) * 100);
  document.getElementById('hub-xp-bar').style.width = Math.min(xpPct, 100) + '%';
  document.getElementById('hub-xp-val').textContent = player.xp + '/' + xpNeeded;

  // Wins, gold & rank
  document.getElementById('hub-wins').textContent = player.wins || 0;
  document.getElementById('hub-gold').textContent = player.gold || 0;
  updateInventoryBadge();
  const rank = getRankInfo(player.wins || 0);

  // Indicador de regen dinámico
  updateRegenStatus();

  // Random tip
  const tip = HUB_TIPS[Math.floor(Math.random() * HUB_TIPS.length)];
  document.getElementById('hub-tip-text').textContent = '"' + tip + '"';

  // Start particles
  initHubParticles();
}

function toggleHubAccordion(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  // Close all
  document.querySelectorAll('.hub-accordion').forEach(a => a.classList.remove('open'));
  // Toggle clicked
  if (!isOpen) el.classList.add('open');
}

function hubStartBattle() {
  startBattle();
}

// ── HUB PARTICLES ──
let hubParticleRAF = null;

function initHubParticles() {
  const canvas = document.getElementById('hub-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth  || window.innerWidth;
  canvas.height = canvas.offsetHeight || window.innerHeight;

  if (hubParticleRAF) cancelAnimationFrame(hubParticleRAF);

  const particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.5 - 0.1,
    alpha: Math.random() * 0.5 + 0.1,
    color: Math.random() > 0.6 ? '#00d4ff' : Math.random() > 0.5 ? '#ffd700' : '#ff6b35',
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Radial glow center
    const grad = ctx.createRadialGradient(
      canvas.width/2, canvas.height*0.4, 0,
      canvas.width/2, canvas.height*0.4, canvas.width * 0.6
    );
    grad.addColorStop(0, 'rgba(0,80,160,0.06)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -5) {
        p.y = canvas.height + 5;
        p.x = Math.random() * canvas.width;
      }
    }
    hubParticleRAF = requestAnimationFrame(draw);
  }
  draw();
}

// Stop particles when leaving hub
function stopHubParticles() {
  if (hubParticleRAF) {
    cancelAnimationFrame(hubParticleRAF);
    hubParticleRAF = null;
  }
}



// =====================================================
// SISTEMA DE CRAFTING
// =====================================================

/** Abre el panel de crafting como overlay */
function openCrafting() {
  // Asegurar que materiales e inventario existen
  player.materials = player.materials || {};
  player.inventory = player.inventory || {};

  renderCraftingPanel();

  const overlay = document.getElementById('crafting-overlay');
  if (overlay) {
    overlay.classList.add('active');
    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
  }
}

/** Cierra el panel de crafting */
function closeCrafting() {
  const overlay = document.getElementById('crafting-overlay');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// ── SMOKE BOMB — escape del combate ──
function useSmokeBomb() {
  if (!player || !player.inventory) return false;
  if (!player.inventory['smoke-bomb'] || player.inventory['smoke-bomb'] <= 0) return false;

  player.inventory['smoke-bomb']--;
  saveGame();

  // Escapar sin XP/oro/drops
  battleState = null;
  setLog('💨 <span class="skill-hl">¡Usaste una Smoke Bomb! Escapaste del combate.</span>');

  setTimeout(() => {
    showScreen('hub');
  }, 1400);
  return true;
}

/** Renderiza solo las recetas en el panel de crafting */
function renderCraftingPanel() {
  // Materiales ya no se muestran aquí — ver pantalla de Inventario

  // ── Recetas ──
  const recipesEl = document.getElementById('craft-recipes-list');
  if (!recipesEl) return;

  recipesEl.innerHTML = CRAFT_RECIPES.map(recipe => {
    const canCraft = canCraftRecipe(recipe);
    const mats     = buildMaterialsHTML(recipe);

    return `
    <div class="craft-card" style="--card-color:${recipe.color};--card-border:${recipe.border}">
      <div class="craft-card-header">
        <span class="craft-icon">${recipe.icon}</span>
        <div class="craft-card-info">
          <div class="craft-name">${recipe.name}</div>
          <div class="craft-desc">${recipe.desc}</div>
        </div>
      </div>
      <div class="craft-materials">${mats}</div>
      <div class="craft-cost">
        <span class="craft-gold-cost">💰 ${recipe.cost_gold} oro</span>
        <button
          class="btn-craft ${canCraft ? '' : 'disabled'}"
          onclick="craftItem('${recipe.id}')"
          ${canCraft ? '' : 'disabled'}
        >
          ${canCraft ? '⚗ CREAR' : '🔒 Faltan materiales'}
        </button>
      </div>
    </div>`;
  }).join('');
}

/** Comprueba si el jugador puede craftear una receta */
function canCraftRecipe(recipe) {
  if ((player.gold || 0) < recipe.cost_gold) return false;
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    if ((player.materials[mat] || 0) < qty) return false;
  }
  return true;
}

/** Genera el HTML de materiales con disponibilidad */
function buildMaterialsHTML(recipe) {
  const parts = Object.entries(recipe.materials).map(([mat, needed]) => {
    const have = player.materials[mat] || 0;
    const item = CRAFT_ITEMS[mat];
    const ok   = have >= needed;
    return `<span class="craft-mat ${ok ? 'mat-ok' : 'mat-missing'}">
      ${item.icon} ${have}/${needed}
    </span>`;
  });

  // Oro
  const haveGold = (player.gold || 0) >= recipe.cost_gold;
  parts.push(`<span class="craft-mat ${haveGold ? 'mat-ok' : 'mat-missing'}">💰 ${player.gold||0}/${recipe.cost_gold}</span>`);

  return parts.join('');
}

/** Ejecuta el crafteo de una receta */
function craftItem(recipeId) {
  const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;

  if (!canCraftRecipe(recipe)) {
    showCraftMsg('❌ No tienes suficientes materiales u oro', 'fail');
    return;
  }

  // Consumir materiales
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    player.materials[mat] -= qty;
  }
  player.gold -= recipe.cost_gold;

  // Agregar al inventario
  player.inventory[recipe.result_item] = (player.inventory[recipe.result_item] || 0) + 1;

  saveGame();

  // Feedback visual
  showCraftMsg(`✨ ¡${recipe.name} creada!`, 'ok');
  triggerCraftEffect();

  // Re-renderizar panel actualizado
  setTimeout(() => renderCraftingPanel(), 300);

  // Actualizar oro en hub
  const hubGold = document.getElementById('hub-gold');
  if (hubGold) hubGold.textContent = player.gold;
}

/** Mensaje de feedback en el panel de crafting */
function showCraftMsg(text, type) {
  const el = document.getElementById('craft-msg');
  if (!el) return;
  el.textContent = text;
  el.className   = 'craft-msg ' + type;
  clearTimeout(window._craftMsgTimer);
  window._craftMsgTimer = setTimeout(() => {
    el.textContent = '';
    el.className   = 'craft-msg';
  }, 2500);
}

/** Efecto visual de partículas al craftear */
function triggerCraftEffect() {
  const panel = document.getElementById('craft-panel');
  if (!panel) return;

  // Glow flash
  panel.classList.add('craft-flash');
  setTimeout(() => panel.classList.remove('craft-flash'), 600);

  // Partículas
  const container = document.getElementById('craft-particles');
  if (!container) return;
  const colors = ['#2ecc71','#00d4ff','#ffd700','#a855f7'];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'craft-particle';
    p.style.cssText = `
      left:${30 + Math.random()*40}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-delay:${Math.random()*0.3}s;
      animation-duration:${0.6 + Math.random()*0.4}s;
    `;
    container.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

/** Actualiza el contador de materiales en el hub-accordion de inventario */
function updateInventoryBadge() {
  if (!player || !player.materials) return;
  const total = Object.values(player.materials).reduce((a, b) => a + b, 0);
  const badge = document.getElementById('inv-materials-count');
  if (badge) badge.textContent = total > 0 ? total : '';
}


// =====================================================
// INVENTARIO — pantalla unificada de materiales y consumibles
// =====================================================

/** Abre la pantalla de inventario */
function openShop() { openInventory(); } // alias retrocompat
function openInventory() {
  showScreen('inventory');
}

/** Actualiza la pantalla de inventario */
function updateInventoryScreen() {
  if (!player) return;
  player.materials = player.materials || {};
  player.inventory = player.inventory || {};

  // Gold display
  const goldEl = document.getElementById('inv-gold-display');
  if (goldEl) goldEl.textContent = player.gold || 0;

  // ── Materiales ──
  const matList = document.getElementById('inv-materials-list');
  if (matList) {
    const entries = Object.entries(CRAFT_ITEMS);
    matList.innerHTML = entries.map(([key, item]) => {
      const qty = player.materials[key] || 0;
      return `<div class="inv-row ${qty > 0 ? '' : 'inv-empty'}">
        <span class="inv-icon">${item.icon}</span>
        <div class="inv-info">
          <span class="inv-name">${item.name}</span>
          <span class="inv-rarity">${item.rarity}</span>
        </div>
        <span class="inv-qty ${qty > 0 ? 'qty-has' : 'qty-zero'}">×${qty}</span>
      </div>`;
    }).join('');
  }

  // ── Consumibles ──
  const consList = document.getElementById('inv-consumables-list');
  if (consList) {
    const entries = Object.entries(CONSUMABLE_ITEMS);
    const hasAny  = entries.some(([k]) => (player.inventory[k] || 0) > 0);
    consList.innerHTML = entries.map(([key, item]) => {
      const qty = player.inventory[key] || 0;
      return `<div class="inv-row ${qty > 0 ? '' : 'inv-empty'}">
        <span class="inv-icon">${item.icon}</span>
        <div class="inv-info">
          <span class="inv-name">${item.name}</span>
          <span class="inv-rarity">${item.escape ? 'Utilidad' : item.hp > 0 ? 'Curación HP' : 'Curación MP'}</span>
        </div>
        <span class="inv-qty ${qty > 0 ? 'qty-has' : 'qty-zero'}">×${qty}</span>
      </div>`;
    }).join('') || '<div style="padding:12px;color:var(--text2);font-size:12px;text-align:center">Sin consumibles — fabrica en el Taller</div>';
  }
}

/** Usar un consumible en combate */
function useCombatItem(key) {
  if (!player) return;
  player.inventory = player.inventory || {};
  const item = CONSUMABLE_ITEMS[key];
  if (!item || (player.inventory[key] || 0) <= 0) {
    addLog(`Sin ${item ? item.name : 'item'} en inventario.`);
    enableActions(true);
    return;
  }

  player.inventory[key]--;
  saveGame();

  if (item.escape) {
    // Smoke bomb
    triggerSmokeBombEscape();
    return;
  }

  // Aplicar efecto
  let logText = '';
  if (item.hp > 0) {
    const prev = player.currentHp;
    player.currentHp = Math.min(player.stats.hp, player.currentHp + item.hp);
    const gained = player.currentHp - prev;
    spawnEffect('fighter-player', 'heal');
    spawnDmgText('fighter-player', `+${gained}HP`, '#2ecc71');
    logText = `<span class="highlight">${player.name}</span> usa <span class="heal-hl">${item.icon} ${item.name}</span> y recupera <span class="heal-hl">+${gained} HP</span>`;
  }
  if (item.mp > 0) {
    const prev = player.currentSp;
    player.currentSp = Math.min(player.stats.sp, player.currentSp + item.mp);
    const gained = player.currentSp - prev;
    spawnDmgText('fighter-player', `+${gained}MP`, '#3498db');
    triggerMpEffect();
    logText += (logText ? ' y ' : `<span class="highlight">${player.name}</span> usa <span class="heal-hl">${item.icon} ${item.name}</span> y recupera `) + `<span style="color:#3498db">+${gained} MP</span>`;
  }

  setLog(logText);
  updateBattleUI();
  closeMenus();

  // Pasar turno al enemigo
  setTimeout(() => enemyTurn(), 900);
}

/** Efecto visual azul para pociones de maná */
function triggerMpEffect() {
  const arena = document.getElementById('battle-arena');
  if (!arena) return;
  const el = document.createElement('div');
  el.className = 'mp-effect-flash';
  arena.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

/** Smoke bomb: escape sin recompensas */
function triggerSmokeBombEscape() {
  setLog('💨 <span class="skill-hl">¡Bomba de humo! Has escapado del combate.</span>');
  closeMenus();

  // Efecto visual humo
  const arena = document.getElementById('battle-arena');
  if (arena) {
    arena.classList.add('smoke-escape');
    setTimeout(() => arena.classList.remove('smoke-escape'), 800);
  }

  // Desactivar botones
  ['btn-attack','btn-skill','btn-defend'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = true;
  });

  setTimeout(() => {
    battleState = null;
    showScreen('hub');
  }, 1000);
}
