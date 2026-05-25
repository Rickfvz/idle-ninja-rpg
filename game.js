/**
 * SHADOW BLADE – game.js
 * Motor de juego optimizado para móvil
 *
 * Spritesheet: 11 cols × 6 filas, 128×128 px por frame
 *   Row 0 → idle   (10 f)   Row 3 → skill  (7 f)
 *   Row 1 → run    (10 f)   Row 4 → hurt   (7 f)
 *   Row 2 → attack (10 f)   Row 5 → death  (10 f)
 */
'use strict';

// ═══════════════════════════════════════════════════
//  SPRITESHEET CONFIG
// ═══════════════════════════════════════════════════
const SS = { FW: 128, FH: 128 };

const ANIM = {
  idle:   { row: 0, frames: 10, fps: 8  },
  run:    { row: 1, frames: 10, fps: 12 },
  attack: { row: 2, frames: 10, fps: 16 },
  skill:  { row: 3, frames:  7, fps: 14 },
  hurt:   { row: 4, frames:  7, fps: 12 },
  death:  { row: 5, frames: 10, fps:  8 },
};

// ═══════════════════════════════════════════════════
//  CANVAS
// ═══════════════════════════════════════════════════
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  const wrapper  = document.getElementById('game-wrapper');
  const hud      = document.getElementById('hud');
  const controls = document.getElementById('controls');
  canvas.width   = wrapper.clientWidth;
  canvas.height  = Math.max(
    wrapper.clientHeight - hud.offsetHeight - controls.offsetHeight,
    180
  );
}

// ═══════════════════════════════════════════════════
//  ASSETS
// ═══════════════════════════════════════════════════
const ninjaImg    = new Image();
ninjaImg.src      = 'assets/Sword_Ninja.png';
let   assetsReady = false;
ninjaImg.onload   = () => { assetsReady = true; };

// ═══════════════════════════════════════════════════
//  ESTADO GLOBAL
// ═══════════════════════════════════════════════════
let state = { running: false, over: false, won: false };
let animFrame;

// Teclas / toques activos
const keys = { left: false, right: false };

// ═══════════════════════════════════════════════════
//  FloatingText
// ═══════════════════════════════════════════════════
class FloatingText {
  constructor(x, y, text, color = '#fff', size = 20) {
    Object.assign(this, { x, y, text, color, size, life: 1, vy: -2, dead: false });
  }
  update(dt) {
    this.y    += this.vy;
    this.vy   *= 0.96;
    this.life -= dt * 1.4;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font        = `bold ${this.size}px Rajdhani, sans-serif`;
    ctx.textAlign   = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth   = 4;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════
//  Particle
// ═══════════════════════════════════════════════════
class Particle {
  constructor(x, y, color) {
    this.x  = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6 - 2;
    this.r  = 2 + Math.random() * 3;
    this.color = color;
    this.life  = 1; this.dead = false;
  }
  update(dt) {
    this.x    += this.vx;
    this.y    += this.vy;
    this.vy   += 0.18;
    this.life -= dt * 2.2;
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

// ═══════════════════════════════════════════════════
//  Sprite base
// ═══════════════════════════════════════════════════
class Sprite {
  constructor(img, x, groundY, scale) {
    this.img       = img;
    this.x         = x;
    this.groundY   = groundY;
    this.scale     = scale;
    this.facingLeft = false;
    this.animName  = 'idle';
    this.anim      = ANIM.idle;
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

  // Devuelve true cuando la animación completó todos sus frames
  tickAnim(dt) {
    this.frameTime += dt;
    const spf = 1 / this.anim.fps;
    if (this.frameTime >= spf) {
      this.frameTime -= spf;
      this.frame++;
      if (this.frame >= this.anim.frames) {
        this.frame = 0;
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    if (!assetsReady) return;
    const dw = SS.FW * this.scale;
    const dh = SS.FH * this.scale;
    const sx = this.frame * SS.FW;
    const sy = this.anim.row * SS.FH;
    const dx = this.x - dw / 2;
    const dy = this.groundY - dh;

    ctx.save();
    if (this.facingLeft) {
      ctx.scale(-1, 1);
      // mirror around sprite center
      ctx.translate(-2 * this.x, 0);
    }
    ctx.drawImage(this.img, sx, sy, SS.FW, SS.FH, dx, dy, dw, dh);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════
//  Player
// ═══════════════════════════════════════════════════
class Player extends Sprite {
  constructor(img, x, groundY, scale) {
    super(img, x, groundY, scale);
    this.maxHp  = 200;
    this.hp     = 200;
    this.speed  = 170;         // px/s
    this.busy   = false;       // bloqueado por animación
    this.dead   = false;
    this.dashing      = false;
    this.dashTimer    = 0;
    this.dashVelX     = 0;
    // Cooldowns (s)
    this.cdAttack = 0;  this.cdMaxAttack = 0.7;
    this.cdSkill  = 0;  this.cdMaxSkill  = 4.0;
    this.cdDash   = 0;  this.cdMaxDash   = 1.6;
  }

  update(dt, leftBound, rightBound) {
    if (this.dead) { this.tickAnim(dt); return; }

    // Tick cooldowns
    this.cdAttack = Math.max(0, this.cdAttack - dt);
    this.cdSkill  = Math.max(0, this.cdSkill  - dt);
    this.cdDash   = Math.max(0, this.cdDash   - dt);
    updateCooldownUI('attack', this.cdAttack, this.cdMaxAttack);
    updateCooldownUI('skill',  this.cdSkill,  this.cdMaxSkill);
    updateCooldownUI('dash',   this.cdDash,   this.cdMaxDash);

    // Dash
    if (this.dashing) {
      this.dashTimer -= dt;
      this.x += this.dashVelX * dt;
      this.x  = clamp(this.x, leftBound, rightBound);
      if (this.dashTimer <= 0) { this.dashing = false; this.busy = false; }
      this.tickAnim(dt);
      return;
    }

    // Animación de acción en curso
    if (this.busy) {
      const done = this.tickAnim(dt);
      if (done) { this.busy = false; this.setAnim('idle'); }
      return;
    }

    // Movimiento
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
    this.setAnim(moving ? 'run' : 'idle');
    this.tickAnim(dt);
  }

  doAttack() {
    if (this.busy || this.dead || this.cdAttack > 0) return false;
    this.busy     = true;
    this.cdAttack = this.cdMaxAttack;
    this.setAnim('attack');
    return true;
  }

  doSkill() {
    if (this.busy || this.dead || this.cdSkill > 0) return false;
    this.busy    = true;
    this.cdSkill = this.cdMaxSkill;
    this.setAnim('skill');
    return true;
  }

  doDash(towardRight) {
    if (this.busy || this.dead || this.cdDash > 0) return false;
    this.busy      = true;
    this.dashing   = true;
    this.dashTimer = 0.22;
    this.dashVelX  = towardRight ? 430 : -430;
    this.facingLeft = !towardRight;
    this.cdDash    = this.cdMaxDash;
    this.setAnim('run');
    return true;
  }

  takeHurt(dmg) {
    if (this.dead) return;
    this.hp   = Math.max(0, this.hp - dmg);
    this.busy = true;
    this.setAnim('hurt');
    this.frame = 0;
    updatePlayerHPUI(this.hp, this.maxHp);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.busy = true;
    this.setAnim('death');
    this.frame = 0;
  }

  attackReachesEnemy(enemyX) {
    return Math.abs(this.x - enemyX) < 110;
  }

  skillReachesEnemy(enemyX) {
    return Math.abs(this.x - enemyX) < 170;
  }
}

// ═══════════════════════════════════════════════════
//  Enemy (Shogun boss)  – dibujado con Canvas shapes
// ═══════════════════════════════════════════════════
class Enemy {
  constructor(x, groundY) {
    this.x         = x;
    this.groundY   = groundY;
    this.maxHp     = 500;
    this.hp        = 500;
    this.dead      = false;
    this.facingLeft = true;
    // IA
    this.aiTimer   = 1.0;
    this.phase     = 'chase';
    this.speed     = 50;
    this.atRange   = 88;
    // Visual
    this.animT     = 0;
    this.moving    = false;
    this.hurtT     = 0;
    this.attackT   = 0;
  }

  get height() { return 100; }

  update(dt, player) {
    if (this.dead) return;
    this.animT += dt;
    this.hurtT  = Math.max(0, this.hurtT  - dt);
    this.attackT = Math.max(0, this.attackT - dt);

    this.aiTimer -= dt;
    const dist = Math.abs(this.x - player.x);

    if (this.aiTimer <= 0) {
      if (dist <= this.atRange)       { this.phase = 'attack'; this.aiTimer = 1.0 + Math.random() * 0.5; }
      else if (dist <= 260)           { this.phase = 'chase';  this.aiTimer = 1.8; }
      else                            { this.phase = 'rest';   this.aiTimer = 0.9; }
    }

    this.moving = false;
    if (this.phase === 'chase' && this.attackT <= 0) {
      const dir = player.x > this.x ? 1 : -1;
      this.x += dir * this.speed * dt;
      this.facingLeft = dir < 0;
      this.moving = true;
    }
  }

  tryAttack(player, floats, particles) {
    if (this.dead || this.attackT > 0 || this.phase !== 'attack') return;
    if (Math.abs(this.x - player.x) > this.atRange + 12) return;
    this.attackT = 1.1;
    const dmg = 14 + Math.floor(Math.random() * 18);
    player.takeHurt(dmg);
    floats.push(new FloatingText(player.x, player.groundY - 90, `-${dmg}`, '#ff4444', 22));
    for (let i = 0; i < 7; i++) particles.push(new Particle(player.x, player.groundY - 65, '#c0392b'));
  }

  takeHurt(dmg, floats, particles) {
    if (this.dead) return;
    this.hp    = Math.max(0, this.hp - dmg);
    this.hurtT = 0.22;
    updateEnemyHPUI(this.hp, this.maxHp);
    floats.push(new FloatingText(this.x, this.groundY - 120, `-${dmg}`, '#f4d03f', 24));
    for (let i = 0; i < 9; i++) particles.push(new Particle(this.x, this.groundY - 70, '#d4a017'));
    if (this.hp <= 0) { this.dead = true; }
  }

  draw(ctx) {
    const t   = this.animT;
    const bob = this.moving ? Math.sin(t * 13) * 4 : Math.sin(t * 3) * 1.5;
    const att = this.attackT > 0;
    const hpct = this.hp / this.maxHp;

    ctx.save();
    if (this.hurtT > 0) ctx.translate((Math.random() - 0.5) * 7, 0);

    // Mirror
    if (!this.facingLeft) {
      ctx.save();
      ctx.translate(this.x * 2, 0);
      ctx.scale(-1, 1);
    }

    const bx = this.x;
    const gy = this.groundY;

    // Sombra
    ctx.globalAlpha = 0.22;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(bx, gy + 1, 36, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Piernas
    const lbob = this.moving ? Math.sin(t * 13) * 7 : 0;
    ctx.fillStyle = '#180505';
    ctx.fillRect(bx - 20, gy - 36 + lbob,  14, 36 - lbob);
    ctx.fillRect(bx +  6, gy - 36 - lbob,  14, 36 + lbob);

    // Cuerpo
    ctx.fillStyle = this.hurtT > 0 ? '#8b0000' : '#200808';
    ctx.beginPath();
    ctx.roundRect(bx - 24, gy - 84 + bob, 48, 50, 5);
    ctx.fill();

    // Armadura pecho
    ctx.fillStyle = this.hurtT > 0 ? '#6e0000' : '#3d0f0f';
    ctx.beginPath();
    ctx.roundRect(bx - 20, gy - 82 + bob, 40, 20, 4);
    ctx.fill();

    // Brazos
    const aSwing = att ? Math.sin(this.attackT * 18) * 30 : (this.moving ? Math.sin(t * 13) * 14 : bob);
    ctx.fillStyle = '#200808';
    ctx.fillRect(bx - 36, gy - 78 + bob + aSwing, 14, 28);
    ctx.fillRect(bx + 22, gy - 78 + bob - aSwing, 14, 28);

    // Cabeza
    ctx.fillStyle = '#180505';
    ctx.beginPath();
    ctx.arc(bx, gy - 90 + bob, 20, 0, Math.PI * 2);
    ctx.fill();

    // Casco con cuernos
    ctx.fillStyle = '#7b0000';
    ctx.beginPath();
    ctx.moveTo(bx - 20, gy - 96 + bob);
    ctx.lineTo(bx - 16, gy - 116 + bob);
    ctx.lineTo(bx - 6,  gy - 100 + bob);
    ctx.lineTo(bx,      gy - 120 + bob);
    ctx.lineTo(bx + 6,  gy - 100 + bob);
    ctx.lineTo(bx + 16, gy - 116 + bob);
    ctx.lineTo(bx + 20, gy - 96 + bob);
    ctx.closePath();
    ctx.fill();

    // Ojos
    const glow = 0.65 + Math.sin(t * 4) * 0.35;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle   = `rgba(255,60,0,${glow})`;
    ctx.beginPath(); ctx.arc(bx - 8, gy - 91 + bob, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 8, gy - 91 + bob, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Nodachi
    ctx.save();
    const wx = bx + 24;
    const wy = gy - 72 + bob;
    const wAngle = att ? -0.6 + Math.sin(this.attackT * 16) * 1.4 : 0.1 + bob * 0.02;
    ctx.translate(wx, wy);
    ctx.rotate(wAngle);
    ctx.fillStyle = '#4a2010'; ctx.fillRect(-4, 0, 8, 22); // mango
    ctx.fillStyle = '#777';    ctx.fillRect(-10, -2, 20, 6); // guardia
    const b = ctx.createLinearGradient(0, -76, 0, 0);
    b.addColorStop(0, '#eee'); b.addColorStop(0.5, '#bbb'); b.addColorStop(1, '#666');
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(1.5, -76); ctx.lineTo(-1.5, -76);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    if (!this.facingLeft) ctx.restore();

    // Mini barra HP
    if (hpct < 1 && !this.dead) {
      const bw = 64, bx2 = this.x - bw / 2, by2 = this.groundY - this.height - 20;
      ctx.fillStyle = '#300'; ctx.fillRect(bx2, by2, bw, 6);
      ctx.fillStyle = hpct > 0.5 ? '#e74c3c' : hpct > 0.25 ? '#e67e22' : '#922b21';
      ctx.fillRect(bx2, by2, bw * hpct, 6);
      ctx.strokeStyle = '#600'; ctx.lineWidth = 1; ctx.strokeRect(bx2, by2, bw, 6);
    }

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════
//  FONDO
// ═══════════════════════════════════════════════════
function drawBg(ctx, w, h) {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
  sky.addColorStop(0, '#040410');
  sky.addColorStop(0.6, '#0c0c1e');
  sky.addColorStop(1, '#1a0808');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Luna
  ctx.save();
  ctx.shadowBlur = 28; ctx.shadowColor = 'rgba(180,190,255,0.35)';
  ctx.fillStyle = '#c8ccea';
  ctx.beginPath(); ctx.arc(w * 0.8, h * 0.14, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#07071c';
  ctx.beginPath(); ctx.arc(w * 0.8 + 8, h * 0.14, 17, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Estrellas
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 45; i++) {
    const sx = (i * 139 + 7) % w;
    const sy = (i * 89  + 3) % (h * 0.5);
    ctx.beginPath(); ctx.arc(sx, sy, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Montañas
  ctx.fillStyle = '#09091a';
  ctx.beginPath(); ctx.moveTo(0, h * 0.55);
  for (let x = 0; x <= w; x += 30)
    ctx.lineTo(x, h * 0.36 + Math.sin(x * 0.025 + 0.8) * h * 0.1);
  ctx.lineTo(w, h * 0.55); ctx.closePath(); ctx.fill();

  // Pagoda silueta
  drawPagoda(ctx, w * 0.14, h * 0.54, Math.min(w, 480) / 480 * 0.65);

  // Suelo
  const gr = ctx.createLinearGradient(0, h * 0.7, 0, h);
  gr.addColorStop(0, '#180a03'); gr.addColorStop(1, '#070402');
  ctx.fillStyle = gr; ctx.fillRect(0, h * 0.7, w, h * 0.3);

  // Línea suelo
  ctx.strokeStyle = '#2e0e04'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, h * 0.7); ctx.lineTo(w, h * 0.7); ctx.stroke();

  // Tablones
  ctx.strokeStyle = 'rgba(60,20,5,0.25)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, h * 0.7); ctx.lineTo(x, h); ctx.stroke();
  }
}

function drawPagoda(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#07070f';
  for (let f = 0; f < 3; f++) {
    const fw = (58 - f * 14) * s, fh = (24 - f * 3) * s, fy = -f * 26 * s;
    ctx.fillRect(-fw / 2, fy - fh, fw, fh);
    ctx.beginPath();
    ctx.moveTo(-fw / 2 - 7 * s, fy - fh);
    ctx.lineTo(0, fy - fh - 11 * s);
    ctx.lineTo(fw / 2 + 7 * s, fy - fh);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawSkillFx(ctx, x, y, frame) {
  if (frame < 2 || frame > 5) return;
  ctx.save();
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i === 1 ? '#88ccff' : '#1a7abf';
    ctx.lineWidth   = 3 - i;
    ctx.shadowBlur  = 16; ctx.shadowColor = '#2980b9';
    ctx.beginPath();
    ctx.arc(x, y, 22 + i * 9, -Math.PI * 0.75, Math.PI * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShadow(ctx, x, y, r) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════════
//  HUD helpers
// ═══════════════════════════════════════════════════
function updatePlayerHPUI(hp, max) {
  document.getElementById('player-hp-bar').style.width = `${Math.max(0, hp / max * 100)}%`;
  document.getElementById('player-hp-text').textContent = `${hp}/${max}`;
}
function updateEnemyHPUI(hp, max) {
  document.getElementById('enemy-hp-bar').style.width = `${Math.max(0, hp / max * 100)}%`;
  document.getElementById('enemy-hp-text').textContent = `${hp}/${max}`;
}

// Cooldown: dibuja un arco SVG sobre el botón (clip-path trick usando border)
function updateCooldownUI(action, remaining, maxCd) {
  const ring = document.getElementById(`cd-${action}`);
  if (!ring) return;
  const pct = remaining / maxCd;
  if (pct <= 0) {
    ring.style.background = 'none';
    ring.style.border     = '3px solid rgba(255,255,255,0.08)';
  } else {
    const deg = Math.round(pct * 360);
    ring.style.background = `conic-gradient(rgba(255,255,255,0.45) ${deg}deg, transparent ${deg}deg)`;
    ring.style.border     = '3px solid transparent';
  }
}

// ═══════════════════════════════════════════════════
//  GAME OBJECTS (inicializados en initGame)
// ═══════════════════════════════════════════════════
let player, enemy, floats, particles;
let hitChecked = { attack: false, skill: false };

function groundY() {
  return Math.floor(canvas.height * 0.72);
}

function initGame() {
  resizeCanvas();
  const w  = canvas.width;
  const gy = groundY();
  const scale = Math.max(0.9, Math.min(1.7, w / 300));

  player    = new Player(ninjaImg, Math.floor(w * 0.22), gy, scale);
  enemy     = new Enemy(Math.floor(w * 0.75), gy);
  floats    = [];
  particles = [];
  hitChecked = { attack: false, skill: false };

  updatePlayerHPUI(player.hp, player.maxHp);
  updateEnemyHPUI(enemy.hp, enemy.maxHp);

  state = { running: true, over: false, won: false };
}

// ═══════════════════════════════════════════════════
//  HIT DETECTION
// ═══════════════════════════════════════════════════
function checkHits() {
  if (!player || !enemy || enemy.dead) return;

  // Ataque básico: daño en frames 4-7
  if (player.animName === 'attack') {
    if (player.frame >= 4 && player.frame <= 7 && !hitChecked.attack) {
      if (player.attackReachesEnemy(enemy.x)) {
        const dmg = 18 + Math.floor(Math.random() * 14);
        enemy.takeHurt(dmg, floats, particles);
        hitChecked.attack = true;
      }
    }
  } else {
    hitChecked.attack = false;
  }

  
  // Skill: daño en frames 3-5
  if (player.animName === 'skill') {
    if (player.frame >= 3 && player.frame <= 5 && !hitChecked.skill) {
      if (player.skillReachesEnemy(enemy.x)) {
        const dmg = 52 + Math.floor(Math.random() * 26);
        enemy.takeHurt(dmg, floats, particles);
        hitChecked.skill = true;
        // Partículas extra
        for (let i = 0; i < 18; i++) {
          const p = new Particle(enemy.x, enemy.groundY - 70, '#3498db');
          p.vx *= 2.2; p.vy *= 2.2; particles.push(p);
        }
      }
    }
  } else {
    hitChecked.skill = false;
  }
}

// ═══════════════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════════════
let lastTime = 0;

function gameLoop(ts) {
  if (!state.running) return;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  const w  = canvas.width;
  const h  = canvas.height;
  const gy = groundY();
  const margin = 28;

  // Sync groundY en caso de resize
  player.groundY = gy;
  enemy.groundY  = gy;

  ctx.clearRect(0, 0, w, h);
  drawBg(ctx, w, h);

  // Update
  player.update(dt, margin, w - margin);
  if (!enemy.dead) {
    enemy.update(dt, player);
    if (!player.dead) enemy.tryAttack(player, floats, particles);
  }
  checkHits();

  // Shadows
  drawShadow(ctx, player.x, gy, 26 * player.scale * 0.55);
  if (!enemy.dead) drawShadow(ctx, enemy.x, gy, 28);

  // Draw sprites
  player.draw(ctx);
  if (!enemy.dead) enemy.draw(ctx);

  // Skill FX
  if (player.animName === 'skill') {
    const fxX = player.x + (player.facingLeft ? -65 : 65);
    drawSkillFx(ctx, fxX, gy - 75, player.frame);
  }

  // Particles + floats
  for (const p of particles) { p.update(dt); p.draw(ctx); }
  particles = particles.filter(p => !p.dead);
  for (const f of floats) { f.update(dt); f.draw(ctx); }
  floats = floats.filter(f => !f.dead);

  // Check win/lose
  if (!state.over) {
    if (enemy.dead) {
      state.over = true; state.won = true;
      setTimeout(() => showOverlay('🏆 VICTORIA', '¡El Shogun ha caído!', '▶ JUGAR DE NUEVO'), 1100);
    } else if (player.dead) {
      state.over = true;
      setTimeout(() => showOverlay('💀 DERROTA', 'El Shogun te ha vencido...', '↺ INTENTAR DE NUEVO'), 1100);
    }
  }

  animFrame = requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════════════
//  OVERLAY
// ═══════════════════════════════════════════════════
function showOverlay(title, sub, btnText) {
  state.running = false;
  cancelAnimationFrame(animFrame);
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').textContent   = sub;
  document.getElementById('overlay-btn').textContent   = btnText;
  document.getElementById('overlay').classList.add('active');
}

document.getElementById('overlay-btn').addEventListener('click', startGame);
document.getElementById('overlay-btn').addEventListener('touchend', (e) => {
  e.preventDefault();
  startGame();
});

function startGame() {
  document.getElementById('overlay').classList.remove('active');
  initGame();
  lastTime = performance.now();
  cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════════════
//  CONTROLES – TECLADO
// ═══════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (!state.running || state.over) return;
  switch (e.code) {
    case 'ArrowLeft':  case 'KeyQ': keys.left  = true;  break;
    case 'ArrowRight': case 'KeyE': keys.right = true;  break;
    case 'KeyA': player.doAttack(); break;
    case 'KeyS': player.doSkill();  break;
    case 'KeyD': player.doDash(enemy.x > player.x); break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowLeft':  case 'KeyQ': keys.left  = false; break;
    case 'ArrowRight': case 'KeyE': keys.right = false; break;
  }
});

// ═══════════════════════════════════════════════════
//  CONTROLES – TÁCTIL  (sin preventDefault en passive)
// ═══════════════════════════════════════════════════

// D-Pad: soporta toque dentro del área completa (no solo el botón)
function setupDpad() {
  const left  = document.getElementById('dpad-left');
  const right = document.getElementById('dpad-right');

  function pressBtn(el, key) {
    el.classList.add('pressed');
    keys[key] = true;
  }
  function releaseBtn(el, key) {
    el.classList.remove('pressed');
    keys[key] = false;
  }

  // Touch
  left.addEventListener('touchstart',  (e) => { e.preventDefault(); pressBtn(left, 'left'); },   { passive: false });
  left.addEventListener('touchend',    (e) => { e.preventDefault(); releaseBtn(left, 'left'); },  { passive: false });
  left.addEventListener('touchcancel', (e) => { releaseBtn(left, 'left'); });
  right.addEventListener('touchstart',  (e) => { e.preventDefault(); pressBtn(right, 'right'); },  { passive: false });
  right.addEventListener('touchend',    (e) => { e.preventDefault(); releaseBtn(right, 'right'); }, { passive: false });
  right.addEventListener('touchcancel', (e) => { releaseBtn(right, 'right'); });

  // Mouse (desktop fallback)
  left.addEventListener('mousedown',  () => pressBtn(left, 'left'));
  left.addEventListener('mouseup',    () => releaseBtn(left, 'left'));
  left.addEventListener('mouseleave', () => releaseBtn(left, 'left'));
  right.addEventListener('mousedown',  () => pressBtn(right, 'right'));
  right.addEventListener('mouseup',    () => releaseBtn(right, 'right'));
  right.addEventListener('mouseleave', () => releaseBtn(right, 'right'));
}

function setupActionBtn(id, fn) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    if (state.running && !state.over) fn();
  }, { passive: false });
  el.addEventListener('touchend', (e) => {
    e.preventDefault();
    el.classList.remove('pressed');
  }, { passive: false });
  el.addEventListener('touchcancel', () => el.classList.remove('pressed'));
  el.addEventListener('mousedown', () => {
    el.classList.add('pressed');
    if (state.running && !state.over) fn();
  });
  el.addEventListener('mouseup',    () => el.classList.remove('pressed'));
  el.addEventListener('mouseleave', () => el.classList.remove('pressed'));
}

setupDpad();
setupActionBtn('btn-attack', () => player?.doAttack());
setupActionBtn('btn-skill',  () => player?.doSkill());
setupActionBtn('btn-dash',   () => player?.doDash(enemy ? enemy.x > player.x : true));

// ═══════════════════════════════════════════════════
//  RESIZE
// ═══════════════════════════════════════════════════
window.addEventListener('resize', () => {
  resizeCanvas();
  if (!state.running) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    drawBg(ctx, w, h);
  }
});

// ═══════════════════════════════════════════════════
//  INIT VISUAL
// ═══════════════════════════════════════════════════
resizeCanvas();
function renderInitBg() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBg(ctx, canvas.width, canvas.height);
}
ninjaImg.addEventListener('load', renderInitBg);
renderInitBg();

// ═══════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
