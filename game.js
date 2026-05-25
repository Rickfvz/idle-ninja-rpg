/**
 * SHADOW BLADE – Ninja RPG
 * game.js – Motor principal del juego
 *
 * Spritesheet: 11 cols × 6 rows, frames de 128×128px
 * Row 0 → idle   (10 frames usables)
 * Row 1 → run    (10 frames)
 * Row 2 → attack (10 frames)
 * Row 3 → skill  ( 7 frames)
 * Row 4 → hurt   ( 7 frames)
 * Row 5 → death  (10 frames)
 */

'use strict';

// ──────────────────────────────────────────────
//  CONSTANTES DE SPRITESHEET
// ──────────────────────────────────────────────
const SS = {
  COLS: 11,
  ROWS: 6,
  FW: 128,   // frame width  en el sheet
  FH: 128,   // frame height en el sheet
};

const ANIM = {
  idle:   { row: 0, frames: 10, fps: 8  },
  run:    { row: 1, frames: 10, fps: 12 },
  attack: { row: 2, frames: 10, fps: 16 },
  skill:  { row: 3, frames:  7, fps: 14 },
  hurt:   { row: 4, frames:  7, fps: 12 },
  death:  { row: 5, frames: 10, fps: 8  },
};

// ──────────────────────────────────────────────
//  CANVAS & CONTEXTO
// ──────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// Ajustamos el canvas al wrapper dinámicamente
function resizeCanvas() {
  const wrapper = document.getElementById('game-wrapper');
  const hud     = document.getElementById('hud');
  const skillBar = document.getElementById('skill-bar');
  const availH  = wrapper.clientHeight - hud.offsetHeight - skillBar.offsetHeight;
  canvas.width  = wrapper.clientWidth;
  canvas.height = Math.max(availH, 200);
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); if (state.running) drawScene(); });

// ──────────────────────────────────────────────
//  CARGA DE ASSETS
// ──────────────────────────────────────────────
const ninjaImg = new Image();
ninjaImg.src   = 'assets/Sword_Ninja.png';

// ──────────────────────────────────────────────
//  ESTADO GLOBAL
// ──────────────────────────────────────────────
const state = {
  running: false,
  gameOver: false,
  won: false,
};

// ──────────────────────────────────────────────
//  CLASE: FloatingText  (texto de daño flotante)
// ──────────────────────────────────────────────
class FloatingText {
  constructor(x, y, text, color = '#fff', size = 18) {
    this.x     = x;
    this.y     = y;
    this.text  = text;
    this.color = color;
    this.size  = size;
    this.life  = 1.0;   // 0..1
    this.vy    = -1.8;  // sube
    this.dead  = false;
  }
  update(dt) {
    this.y    += this.vy;
    this.vy   *= 0.97;
    this.life -= dt * 1.2;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font        = `bold ${this.size}px 'Rajdhani', sans-serif`;
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth   = 3;
    ctx.textAlign   = 'center';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ──────────────────────────────────────────────
//  CLASE: Particle  (efectos visuales)
// ──────────────────────────────────────────────
class Particle {
  constructor(x, y, color) {
    this.x    = x;
    this.y    = y;
    this.vx   = (Math.random() - 0.5) * 5;
    this.vy   = (Math.random() - 0.5) * 5 - 2;
    this.r    = 2 + Math.random() * 4;
    this.color = color;
    this.life  = 1.0;
    this.dead  = false;
  }
  update(dt) {
    this.x    += this.vx;
    this.y    += this.vy;
    this.vy   += 0.15;   // gravedad
    this.life -= dt * 2;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ──────────────────────────────────────────────
//  CLASE: Sprite base
// ──────────────────────────────────────────────
class Sprite {
  constructor(img, x, y, scale = 1.5) {
    this.img       = img;
    this.x         = x;
    this.y         = y;             // posición Y del suelo (feet)
    this.scale     = scale;
    this.facingLeft = false;
    // Animación
    this.anim      = ANIM.idle;
    this.animName  = 'idle';
    this.frame     = 0;
    this.frameTime = 0;
  }

  setAnim(name) {
    if (this.animName === name) return;
    this.animName  = name;
    this.anim      = ANIM[name];
    this.frame     = 0;
    this.frameTime = 0;
  }

  updateAnim(dt) {
    this.frameTime += dt;
    const spf = 1 / this.anim.fps;   // seconds per frame
    if (this.frameTime >= spf) {
      this.frameTime -= spf;
      this.frame++;
      if (this.frame >= this.anim.frames) {
        return true;  // animación completó un ciclo
      }
    }
    return false;
  }

  draw(ctx) {
    const dw = SS.FW * this.scale;
    const dh = SS.FH * this.scale;
    const sx = this.frame * SS.FW;
    const sy = this.anim.row * SS.FH;
    const dx = this.x - dw / 2;
    const dy = this.y - dh;            // pies en this.y

    ctx.save();
    if (this.facingLeft) {
      ctx.translate(this.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-this.x, 0);
    }
    ctx.drawImage(this.img, sx, sy, SS.FW, SS.FH, dx, dy, dw, dh);
    ctx.restore();
  }
}

// ──────────────────────────────────────────────
//  CLASE: Player
// ──────────────────────────────────────────────
class Player extends Sprite {
  constructor(img, x, y) {
    super(img, x, y, 1.6);
    this.maxHp     = 200;
    this.hp        = 200;
    this.speed     = 160;
    this.width     = 40;    // hitbox
    // Estados
    this.busy      = false;  // en medio de un ataque/skill/hurt/death
    this.dead      = false;
    this.dashing   = false;
    this.dashTimer = 0;
    this.dashDir   = 1;
    this.dashSpeed = 420;
    // Cooldowns (segundos)
    this.cd = { attack: 0, skill: 0, dash: 0 };
    this.cdMax = { attack: 0.8, skill: 4.0, dash: 1.5 };
  }

  update(dt, keys, groundY, leftBound, rightBound) {
    if (this.dead) {
      this.updateAnim(dt);
      return;
    }

    // Tick cooldowns
    for (const k in this.cd) {
      if (this.cd[k] > 0) {
        this.cd[k] = Math.max(0, this.cd[k] - dt);
        updateCooldownUI(k, this.cd[k], this.cdMax[k]);
      } else {
        updateCooldownUI(k, 0, this.cdMax[k]);
      }
    }

    // Dash movement
    if (this.dashing) {
      this.dashTimer -= dt;
      this.x += this.dashDir * this.dashSpeed * dt;
      this.x  = Math.max(leftBound, Math.min(rightBound, this.x));
      if (this.dashTimer <= 0) {
        this.dashing = false;
        this.busy    = false;
      }
      this.updateAnim(dt);
      return;
    }

    // Busy (attack/skill/hurt animation playing)
    if (this.busy) {
      const done = this.updateAnim(dt);
      if (done) {
        this.busy = false;
        this.setAnim('idle');
      }
      return;
    }

    // Movimiento horizontal
    let moving = false;
    if (keys.left) {
      this.x -= this.speed * dt;
      this.x  = Math.max(leftBound, this.x);
      this.facingLeft = true;
      moving = true;
    }
    if (keys.right) {
      this.x += this.speed * dt;
      this.x  = Math.min(rightBound, this.x);
      this.facingLeft = false;
      moving = true;
    }

    // Animación idle/run
    if (!moving) { this.setAnim('idle'); }
    else         { this.setAnim('run');  }

    this.updateAnim(dt);
  }

  doAttack() {
    if (this.busy || this.dead || this.cd.attack > 0) return false;
    this.busy      = true;
    this.cd.attack = this.cdMax.attack;
    this.setAnim('attack');
    this.frame = 0;
    return true;
  }

  doSkill() {
    if (this.busy || this.dead || this.cd.skill > 0) return false;
    this.busy     = true;
    this.cd.skill = this.cdMax.skill;
    this.setAnim('skill');
    this.frame = 0;
    return true;
  }

  doDash(dirRight) {
    if (this.busy || this.dead || this.cd.dash > 0) return false;
    this.busy      = true;
    this.dashing   = true;
    this.dashDir   = dirRight ? 1 : -1;
    this.dashTimer = 0.25;
    this.cd.dash   = this.cdMax.dash;
    this.facingLeft = !dirRight;
    this.setAnim('run');
    return true;
  }

  takeHurt(dmg) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - dmg);
    updatePlayerHPUI(this.hp, this.maxHp);
    this.setAnim('hurt');
    this.frame = 0;
    this.busy  = true;
    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.dead = true;
    this.busy = true;
    this.setAnim('death');
    this.frame = 0;
  }

  getAttackBox() {
    // Hitbox delante del jugador
    const dir = this.facingLeft ? -1 : 1;
    return {
      x: this.x + dir * 20,
      y: this.y - SS.FH * this.scale * 0.7,
      w: 70, h: 60,
    };
  }
}

// ──────────────────────────────────────────────
//  CLASE: Enemy (Shogun Boss)
// ──────────────────────────────────────────────
class Enemy {
  constructor(x, y) {
    this.x        = x;
    this.y        = y;
    this.maxHp    = 500;
    this.hp       = 500;
    this.width    = 50;
    this.height   = 90;
    this.dead     = false;
    // IA simple
    this.aiTimer  = 0;
    this.aiPhase  = 'chase';   // chase | attack | rest
    this.phaseTimer = 0;
    this.speed    = 55;
    this.attackRange = 90;
    // Animación propia con canvas shapes
    this.anim     = 'idle';
    this.animT    = 0;
    this.attackT  = 0;
    this.isAttacking = false;
    this.hurtT    = 0;
    this.isHurt   = false;
  }

  update(dt, player) {
    if (this.dead) return;

    this.animT += dt;

    if (this.isHurt) {
      this.hurtT -= dt;
      if (this.hurtT <= 0) this.isHurt = false;
    }

    if (this.isAttacking) {
      this.attackT -= dt;
      if (this.attackT <= 0) this.isAttacking = false;
      return;
    }

    this.phaseTimer -= dt;

    const dist = Math.abs(this.x - player.x);

    if (this.phaseTimer <= 0) {
      // Decide siguiente acción
      if (dist <= this.attackRange) {
        this.aiPhase    = 'attack';
        this.phaseTimer = 0.9 + Math.random() * 0.6;
      } else if (dist <= 200) {
        this.aiPhase    = 'chase';
        this.phaseTimer = 1.5;
      } else {
        this.aiPhase    = 'rest';
        this.phaseTimer = 0.8;
      }
    }

    if (this.aiPhase === 'chase') {
      const dir = player.x > this.x ? 1 : -1;
      this.x += dir * this.speed * dt;
      this.anim = 'run';
    } else {
      this.anim = 'idle';
    }
  }

  tryAttack(player, floats, particles) {
    // Llamado desde game loop cuando quiere atacar
    if (this.isAttacking || this.dead) return false;
    const dist = Math.abs(this.x - player.x);
    if (dist > this.attackRange + 10) return false;
    if (this.aiPhase !== 'attack') return false;

    this.isAttacking = true;
    this.attackT     = 0.5;
    this.anim        = 'attack';

    // Daño al jugador
    const dmg = 15 + Math.floor(Math.random() * 20);
    player.takeHurt(dmg);
    // Texto daño
    floats.push(new FloatingText(player.x, player.y - 80, `-${dmg}`, '#ff4444', 20));
    // Partículas
    for (let i = 0; i < 6; i++) particles.push(new Particle(player.x, player.y - 60, '#e74c3c'));
    return true;
  }

  takeHurt(dmg, floats, particles) {
    if (this.dead) return;
    this.hp     = Math.max(0, this.hp - dmg);
    this.isHurt = true;
    this.hurtT  = 0.2;
    updateEnemyHPUI(this.hp, this.maxHp);
    floats.push(new FloatingText(this.x, this.y - 110, `-${dmg}`, '#ffcc00', 22));
    for (let i = 0; i < 8; i++) particles.push(new Particle(this.x, this.y - 60, '#d4a017'));
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
  }

  draw(ctx) {
    const pulse = Math.sin(this.animT * 8) * 3;
    const hpPct = this.hp / this.maxHp;

    ctx.save();

    // Shake si está siendo golpeado
    if (this.isHurt) {
      ctx.translate((Math.random() - 0.5) * 6, 0);
    }

    // Sombra en el suelo
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyY = this.y - this.height;
    const legW  = 14;
    const legH  = 28;

    // ── Legs ──
    const legBob = this.anim === 'run' ? Math.sin(this.animT * 12) * 5 : 0;
    ctx.fillStyle = '#1a0a0a';
    // Pierna izq
    ctx.fillRect(this.x - legW - 4, this.y - legH + legBob, legW, legH - legBob);
    // Pierna der
    ctx.fillRect(this.x + 4, this.y - legH - legBob, legW, legH + legBob);

    // ── Body (torso) ──
    const bodyColor = this.isHurt ? '#cc2200' : '#2d0a0a';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(this.x - 22, bodyY + 10, 44, 40, 4);
    ctx.fill();

    // Armadura (platos) 
    ctx.fillStyle = this.isHurt ? '#883300' : '#4a1010';
    ctx.beginPath();
    ctx.roundRect(this.x - 18, bodyY + 10, 36, 16, 3);
    ctx.fill();

    // ── Arms ──
    const armSwing = this.isAttacking
      ? Math.sin(this.attackT * 20) * 25
      : (this.anim === 'run' ? Math.sin(this.animT * 12) * 12 : pulse / 2);

    ctx.fillStyle = '#2d0a0a';
    // Brazo izq
    ctx.fillRect(this.x - 34, bodyY + 12 + armSwing, 14, 26);
    // Brazo der
    ctx.fillRect(this.x + 20, bodyY + 12 - armSwing, 14, 26);

    // ── Cabeza ──
    ctx.fillStyle = '#1a0505';
    ctx.beginPath();
    ctx.arc(this.x, bodyY + 6, 18, 0, Math.PI * 2);
    ctx.fill();

    // Casco / corona
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.moveTo(this.x - 18, bodyY + 2);
    ctx.lineTo(this.x - 14, bodyY - 16);
    ctx.lineTo(this.x - 6,  bodyY + 0);
    ctx.lineTo(this.x,      bodyY - 20);
    ctx.lineTo(this.x + 6,  bodyY + 0);
    ctx.lineTo(this.x + 14, bodyY - 16);
    ctx.lineTo(this.x + 18, bodyY + 2);
    ctx.fill();

    // Ojos rojos
    const eyeGlow = 0.7 + Math.sin(this.animT * 3) * 0.3;
    ctx.fillStyle = `rgba(255,0,0,${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(this.x - 7, bodyY + 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x + 7, bodyY + 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // ── Arma (nodachi gigante) ──
    ctx.save();
    ctx.translate(this.x + 22, bodyY + 22);
    const weaponAngle = this.isAttacking
      ? -0.8 + Math.sin(this.attackT * 15) * 1.2
      : 0.15 + pulse * 0.02;
    ctx.rotate(weaponAngle);
    // Mango
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(-4, 0, 8, 20);
    // Guardia
    ctx.fillStyle = '#888';
    ctx.fillRect(-10, -2, 20, 6);
    // Hoja
    const blade = ctx.createLinearGradient(0, -70, 0, 0);
    blade.addColorStop(0, '#eee');
    blade.addColorStop(0.5, '#aaa');
    blade.addColorStop(1, '#666');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.lineTo(1, -70);
    ctx.lineTo(-1, -70);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // HP bar sobre la cabeza (solo visible cuando tiene daño)
    if (hpPct < 1) {
      const bw = 60;
      const bx = this.x - bw / 2;
      const by = bodyY - 28;
      ctx.fillStyle = '#300';
      ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = hpPct > 0.5 ? '#e74c3c' : hpPct > 0.25 ? '#e67e22' : '#c0392b';
      ctx.fillRect(bx, by, bw * hpPct, 6);
      ctx.strokeStyle = '#500';
      ctx.strokeRect(bx, by, bw, 6);
    }

    ctx.restore();
  }
}

// ──────────────────────────────────────────────
//  ESCENA / FONDO
// ──────────────────────────────────────────────
function drawBackground(ctx, w, h) {
  // Sky gradient – noche dramática
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#050510');
  sky.addColorStop(0.5, '#0d0d20');
  sky.addColorStop(1, '#1a0a0a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Luna
  ctx.save();
  ctx.shadowBlur  = 30;
  ctx.shadowColor = 'rgba(200,200,255,0.4)';
  ctx.fillStyle   = '#d8d8f0';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.12, 22, 0, Math.PI * 2);
  ctx.fill();
  // Luna creciente (sombra)
  ctx.fillStyle = '#07071a';
  ctx.beginPath();
  ctx.arc(w * 0.82 + 9, h * 0.12, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Estrellas (estáticas, generadas por seed)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137.5 + 10) % w);
    const sy = ((i * 91.3 + 5) % (h * 0.45));
    const r  = 0.5 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silueta montañas lejanas
  ctx.fillStyle = '#0a0a18';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.52);
  for (let x = 0; x <= w; x += 40) {
    const peak = h * 0.35 + Math.sin(x * 0.03 + 1) * h * 0.08;
    ctx.lineTo(x, peak);
  }
  ctx.lineTo(w, h * 0.52);
  ctx.closePath();
  ctx.fill();

  // Silueta pagoda al fondo
  drawPagoda(ctx, w * 0.15, h * 0.5, 0.6);

  // Suelo
  const ground = ctx.createLinearGradient(0, h * 0.72, 0, h);
  ground.addColorStop(0, '#1a0d05');
  ground.addColorStop(0.3, '#120a04');
  ground.addColorStop(1, '#080503');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // Línea de suelo
  ctx.strokeStyle = '#3a1505';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.lineTo(w, h * 0.72);
  ctx.stroke();

  // Tablones del suelo
  ctx.strokeStyle = 'rgba(80,30,5,0.3)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 35) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.72);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

function drawPagoda(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#08080f';
  // Pisos
  for (let floor = 0; floor < 3; floor++) {
    const fw = (60 - floor * 15) * scale;
    const fh = (25 - floor * 3) * scale;
    const fy = -floor * 28 * scale;
    ctx.fillRect(-fw / 2, fy - fh, fw, fh);
    // Tejado
    ctx.beginPath();
    ctx.moveTo(-fw / 2 - 8 * scale, fy - fh);
    ctx.lineTo(0, fy - fh - 12 * scale);
    ctx.lineTo(fw / 2 + 8 * scale, fy - fh);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ──────────────────────────────────────────────
//  ACTUALIZACIÓN HUD
// ──────────────────────────────────────────────
function updatePlayerHPUI(hp, max) {
  const pct = Math.max(0, hp / max);
  document.getElementById('player-hp-bar').style.width = `${pct * 100}%`;
  document.getElementById('player-hp-text').textContent = `${hp}/${max}`;
}

function updateEnemyHPUI(hp, max) {
  const pct = Math.max(0, hp / max);
  document.getElementById('enemy-hp-bar').style.width = `${pct * 100}%`;
  document.getElementById('enemy-hp-text').textContent = `${hp}/${max}`;
}

function updateCooldownUI(action, remaining, maxCd) {
  const el = document.getElementById(`cd-${action}`);
  if (!el) return;
  const pct = remaining / maxCd;
  el.style.transform = `scaleY(${pct})`;
}

// ──────────────────────────────────────────────
//  LÓGICA DEL JUEGO
// ──────────────────────────────────────────────
let player, enemy, floats, particles;
let keys = { left: false, right: false };
let lastTime = 0;
let animFrame;
let lastAttackHit = false;   // evitar múltiple daño en mismo ataque
let lastSkillHit  = false;

function initGame() {
  const w = canvas.width;
  const h = canvas.height;
  const groundY = Math.floor(h * 0.72);

  player    = new Player(ninjaImg, Math.floor(w * 0.25), groundY);
  enemy     = new Enemy(Math.floor(w * 0.75), groundY);
  floats    = [];
  particles = [];
  lastAttackHit = false;
  lastSkillHit  = false;

  updatePlayerHPUI(player.hp, player.maxHp);
  updateEnemyHPUI(enemy.hp, enemy.maxHp);

  state.running  = true;
  state.gameOver = false;
  state.won      = false;
}

function checkAttackHit() {
  if (!player || !enemy || enemy.dead) return;
  if (player.animName === '
    if (player.frame >= 4 && player.frame <= 7) {
      const box = player.getAttackBox();
      const ex  = enemy.x;
      const ey  = enemy.y - enemy.height / 2;
      // Chequeo simple de distancia
      if (Math.abs(player.x - enemy.x) < 100) {
        const dmg = 20 + Math.floor(Math.random() * 15);
        enemy.takeHurt(dmg, floats, particles);
        lastAttackHit = true;
      }
    }
  }
  if (player.animNam