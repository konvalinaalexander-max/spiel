// Spielablauf im Browser: verbindet Session (Logik) mit Welt (3D), Laptop-OS, Spielerfigur, Audio und HUD.
import * as THREE from 'three';
import { Session } from './session.js';
import { Bot } from './bot.js';
import { seatMultiplier } from './config.js';
import { ProfView } from '../chars/profView.js';
import { PlayerView } from '../chars/playerView.js';
import { LaptopOS, LAPTOP_SIZE } from '../laptop/os.js';
import { SLIDE_META } from './world.js';
import { t, getLang } from '../ui/i18n.js';
import { clamp, damp, lerp, smoothstep } from '../core/util.js';
import * as LY from '../scene/layout.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const OS_SFX = { click: 'keyClick', key: 'keyClick', touchpad: 'touchpad', notify: 'notify', eat: 'snakeEat', die: 'snakeDie' };
const PHASE_KEYS = { arrival: 'arrival', intro: 'intro', part1: 'part1', break: 'break', part2: 'part2', closing: 'closing' };

export class Game {
  constructor(o) {
    Object.assign(this, o); // gfx, world, content, ui, hud, input, audio, settings, cfg, onEnd
    const W = this.world, lang = getLang();
    this.lang = lang;
    const cfg = this.cfg;
    this.session = new Session({ difficulty: cfg.difficulty, length: cfg.length, seat: cfg.seat, mode: cfg.mode, opponent: cfg.opponent, oppSkill: cfg.opponent === 'online' ? cfg.oppSkill : undefined, seed: cfg.seed || (Date.now() % 100000), popSeed: 4711, lang, weather: cfg.weather }, this.content, (type, d) => { this._on(type, d); if (this.bot) this.bot.onEvent(type, d); });
    const S = this.session;
    // Autopilot (Demo/Test): ?bot=0.6
    if (this.botSkill != null) this.bot = new Bot(S, this.botSkill, 99);
    this.sections = this.content.sections;
    // Prof
    this.profView = new ProfView(this.gfx, W.charMat, S.prof, W.fx, this.audio);
    this.profView.onStep = (f, c) => this.audio.play(c.pos.z > LY.ROW0_Z ? 'stepStair' : 'stepParquet', { pos: c.pos.clone().add(V(0, 0.05, 0)), gain: 0.5, vary: 0.15 });
    // eigener Körper
    this.player = new PlayerView(this.gfx, W.charMat, S, W.props, cfg.avatar || 'a');
    this.player.fovBase = this.settings.fov || 60; this.player.reducedMotion = !!this.settings.reducedMotion;
    // Laptop
    const lap = W.props.player.laptop;
    this.os = new LaptopOS({
      getTime: () => ({ hm: this._hm(), date: t('os.date') }),
      getSections: () => S.director.presented.map(p => this._sec(p.id)).filter(Boolean),
      getAllSections: () => this.sections.map(s => ({ ...s[this.lang], id: s.id, order: s.order })),
      sfx: n => this.audio.play(OS_SFX[n] || n, { bus: 'player', gain: n === 'notify' ? 0.5 : 0.35 }),
      ttt: S.ttt, opponent: { get name() { return S.opp.name; }, get typing() { return S.opp.typing; }, get where() { return S.opp.where ? t('os.ttt.where', S.opp.where) : t('os.ttt.online'); } },
      onNotify: (kind, muted) => S.notifyRaised(muted || S.player.muted),
      onCell: i => this._place(i), onNextRound: () => S.nextRound(),
      onSnake: score => { S.stats.snake = Math.max(S.stats.snake, score); },
      target: () => S.target, colorblind: this.settings.colorblind
    });
    this.osTex = new THREE.CanvasTexture(this.os.canvas); this.osTex.colorSpace = THREE.SRGBColorSpace; this.osTex.anisotropy = this.gfx.renderer.capabilities.getMaxAnisotropy();
    lap.screenMat.map = this.osTex; lap.screenMat.needsUpdate = true;
    this.os.draw(); this.osTex.needsUpdate = true;
    // Zustand
    this.t = 0; this.paused = false; this.ended = false;
    this.lid = 108; this.lidTarget = 108; this.brightness = 0.85;
    this.cursor = { x: 0.55, y: 0.5 }; this.mouseMoveT = 0; this.typingT = 0; this.lidMoveT = 0;
    this.board = { job: null, panel: null, delay: 0, speed: 0, penWorld: null, scratch: 0 };
    this.speech = { until: 0, est: 0, start: 0 };
    this.lastSlide = null; this.slideNo = 0;
    this.debug = false; this.notesLines = new Map();
    this.hintsOn = cfg.hints !== false;
    S.externalBusy = () => this._busy();
    // Startzustand Leinwand: Beamer aus, Desktop des Prof-Laptops vorbereitet
    W.fx.slides.desktop(SLIDE_META[lang], '09:57'); W.fx.updateSlideTextures(); W.fx.setBeamer(false);
    // Profs Kopfposition für Studierende
    this.hud.show(true); this.hud.setStrikes(0); this.hud.touch(matchMedia('(pointer: coarse)').matches);
    this.hud.setScore(S.ttt, S.target);
    this._prompt = null;
    // Ambiente
    this._startAmbience();
    this.audio.stopMusic();
    // Mails zeitversetzt
    this.mailPlan = [[40, 'mensa'], [220, 'peer']];
  }
  _sec(id) { const s = this.sections.find(x => x.id === id); return s ? { ...s[this.lang], id: s.id, order: s.order } : null; }
  _hm() { const m = this.session.director.clockMinutes(); const hh = Math.floor(m / 60), mm = Math.floor(m % 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
  _busy() {
    // in Spielzeit gemessen (robust gegen Sprachausgaben ohne onend und gegen Vorspulen im Test)
    const speaking = this.audio.speaking && this.t < this.speech.start + this.speech.est * 1.6 + 1.5;
    const chalk = !!(this.board.panel && this.board.panel.chalk.busy && this.t < this.board.deadline);
    return speaking || chalk;
  }
  _startAmbience() {
    const A = this.audio, W = this.world;
    A.loop('ventilation', { gain: 0.25, bus: 'room' });
    A.loop('roomTone', { gain: 0.35, bus: 'room' });
    A.loop('murmur', { gain: 0.5, bus: 'room' });
    A.loop('traffic', { pos: V(LY.ROOM.x0 - 3, 1, 0), gain: this.cfg.weather === 'rain' ? 0.2 : 0.3, bus: 'room' });
    if (this.cfg.weather === 'rain') A.loop('rain', { pos: V(LY.ROOM.x0 - 1, 2.5, 0), gain: 0.45, bus: 'room' });
    if (this.cfg.weather !== 'sunny') A.loop('wind', { pos: V(LY.ROOM.x0 - 1, 2.5, -2), gain: 0.12, bus: 'room' });
    void W;
  }
  // ------------------------------------------------------------------ Eingaben
  _place(i) { if (this.session.tttPlay(i)) { this.audio.play('ttPlace', { bus: 'player', gain: 0.4 }); this.typingT = 0.25; } }
  handleInput(dt) {
    const I = this.input, S = this.session, p = S.player, os = this.os;
    const inp = I.poll();
    const gp = inp.gp;
    if (this.paused || this.ended) { I.endFrame(); return { dx: 0, dy: 0 }; }
    I._laptopFocus = p.blend > 0.5;
    let dx = inp.dx, dy = inp.dy;
    if (gp) { dx += gp.rx * 600 * dt + (p.blend < 0.5 ? gp.lx * 500 * dt : 0); dy += gp.ry * 600 * dt + (p.blend < 0.5 ? gp.ly * 500 * dt : 0); }
    // Tastatur-Blick (Pfeile/WASD) im Zuhör-Modus
    if (p.blend < 0.5 && p.mode !== 'notes') { dx += ((I.is('lookRight') ? 1 : 0) - (I.is('lookLeft') ? 1 : 0)) * 520 * dt; dy += ((I.is('lookDown') ? 1 : 0) - (I.is('lookUp') ? 1 : 0)) * 420 * dt; }
    // Moduswechsel
    const toggle = I.hit('toggleLaptop') || inp.rclick || gp?.b;
    if (toggle) {
      if (S.quiz) { /* während einer Frage nicht */ }
      else if (p.mode === 'laptop') S.setMode('listen'); else S.setMode('laptop');
    }
    const notesHeld = I.is('notes') || gp?.x;
    if (this.bot) { /* Autopilot steuert die Modi */ }
    else if (notesHeld && p.mode !== 'laptop' && !S.quiz) { if (p.mode !== 'notes') S.setMode('notes'); }
    else if (!notesHeld && p.mode === 'notes') S.setMode('listen');
    // Laptop-Bedienung
    if (p.blend > 0.5) {
      // Cursor: Maus (gesperrt) bewegt den virtuellen Cursor
      const sx = LAPTOP_SIZE.W, sy = LAPTOP_SIZE.H;
      let cdx = inp.dx * 1.1, cdy = inp.dy * 1.1;
      if (gp) { cdx += gp.lx * 900 * dt; cdy += gp.ly * 900 * dt; }
      if (cdx || cdy) { os.pointerBy(cdx, cdy); this.mouseMoveT = 0.4; S.handActivity(Math.min(0.08, Math.hypot(cdx, cdy) * 0.0015)); }
      this.cursor.x = os.cursor.x / sx; this.cursor.y = os.cursor.y / sy;
      dx *= 0.15; dy *= 0.15;
      if (inp.click || gp?.a) { os.click(); this.clicked = true; S.handActivity(0.25); }
      for (const tap of inp.taps) this._tapLaptop(tap);
      const cell = I.cellHit(); if (cell >= 0) { this._place(cell); }
      for (const c of I.pressed) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'PageUp', 'PageDown'].includes(c) && os.key(c)) { this.typingT = 0.2; S.handActivity(0.15); } }
      if ((I.hit('altTab') || gp?.y) && !(this.altTabT > 0)) { this.altTabT = 0.3; this.typingT = 0.2; this.audio.play('keyClick', { bus: 'player', gain: 0.3 }); }
      if (I.hit('nextRound') || (gp?.start && S.ttt.over)) S.nextRound();
      if (gp?.up || gp?.down || gp?.left || gp?.right) this._gpCell(gp);
    } else {
      for (const tap of inp.taps) void tap;
    }
    // Deckel (Mausrad / L / Schultertasten), Helligkeit, Kopfhörer, Stumm
    if (inp.wheel) { this.lidTarget = clamp(this.lidTarget - inp.wheel * 6, 62, 118); this.lidMoveT = 0.5; }
    if (I.hit('lid')) { this.lidTarget = this.lidTarget > 95 ? 76 : 108; this.lidMoveT = 0.6; }
    if (gp?.lb) { this.lidTarget = clamp(this.lidTarget - 60 * dt, 62, 118); this.lidMoveT = 0.3; }
    if (gp?.rb) { this.lidTarget = clamp(this.lidTarget + 60 * dt, 62, 118); this.lidMoveT = 0.3; }
    if (I.hit('brightUp')) { this.brightness = clamp(this.brightness + 0.1, 0.15, 1); this.audio.play('keyClick', { bus: 'player', gain: 0.25 }); this.hud.toast(t('hud.brightness', { v: Math.round(this.brightness * 100) })); }
    if (I.hit('brightDown')) { this.brightness = clamp(this.brightness - 0.1, 0.15, 1); this.audio.play('keyClick', { bus: 'player', gain: 0.25 }); this.hud.toast(t('hud.brightness', { v: Math.round(this.brightness * 100) })); }
    if (I.hit('headphones')) { p.headphones = !p.headphones; this.audio.play('cloth', { bus: 'player', gain: 0.4 }); this.hud.toast(t(p.headphones ? 'hud.phonesOn' : 'hud.phonesOff')); }
    if (I.hit('mute')) { p.muted = !p.muted; os.muted = p.muted; os.dirty = true; this.hud.toast(t(p.muted ? 'hud.muteOn' : 'hud.muteOff')); }
    if (I.hit('sign') && !this.sign && p.blend < 0.5 && S.list && S.list.holder === 'player' && !S.list.signed && !S.list.signing) { this.sign = { len: 0 }; this.hud.signOpen(); }
    if (this.sign) {
      // Unterschreiben: kurze Mausgeste (Linienzug), dabei kein Umschauen
      const m = Math.hypot(inp.dx, inp.dy);
      if (m > 0) { this.sign.len += m; this.hud.signDraw(inp.dx, inp.dy); if (Math.random() < 0.3) this.audio.play('penWrite', { bus: 'player', gain: 0.35 }); }
      dx = 0; dy = 0;
      if (this.sign.len > 700 || (gp && gp.a)) { this.hud.signClose(true); this.sign = null; if (S.signList()) S.list.signing = 0.35; }
      else if (I.hit('pause') || !S.list || S.list.holder !== 'player') { this.hud.signClose(false); this.sign = null; }
    }
    // Quiz
    if (S.quiz && !S.quiz.answered) {
      for (let k = 0; k < 4; k++) if (I.hit('answer' + (k + 1)) && k < S.quiz.answers.length) S.answerQuiz(k);
      if (I.hit('peek')) this._peek();
    }
    if (I.hit('profView')) this.debug = !this.debug;
    if (I.hit('help')) this.hooks.help?.();
    if (I.hit('pause') || gp?.start && !S.ttt.over) this.hooks.pause?.();
    I.endFrame();
    return { dx, dy };
  }
  _gpCell(gp) { const c = this._gpSel ?? 4; const r = Math.floor(c / 3), k = c % 3; const nr = clamp(r + (gp.down ? 1 : 0) - (gp.up ? 1 : 0), 0, 2), nk = clamp(k + (gp.right ? 1 : 0) - (gp.left ? 1 : 0), 0, 2); this._gpSel = nr * 3 + nk; this._place(this._gpSel); }
  _tapLaptop(tap) {
    // Bildschirmpunkt → Laptop-Bildschirm (Raycast)
    const r = new THREE.Raycaster(), ndc = new THREE.Vector2(tap.x / innerWidth * 2 - 1, -(tap.y / innerHeight) * 2 + 1);
    r.setFromCamera(ndc, this.gfx.camera);
    const hit = r.intersectObject(this.world.props.player.laptop.screen, false)[0];
    if (hit && hit.uv) { this.os.pointerTo(hit.uv.x * LAPTOP_SIZE.W, (1 - hit.uv.y) * LAPTOP_SIZE.H); this.os.click(); this.clicked = true; }
  }
  _peek() { const r = this.session.peekNotes(); if (r !== null && r !== undefined) { this.hud.quizRemove(r); this.audio.play('pageTurn', { bus: 'player', gain: 0.5 }); } }
  // ------------------------------------------------------------------ Ereignisse der Session
  _on(type, d) {
    const W = this.world, A = this.audio, S = this.session, H = this.hud;
    switch (type) {
      case 'say': this._say(d); break;
      case 'slide': this._slide(d); break;
      case 'board': this._board(d); break;
      case 'beamer': W.fx.setBeamer(d.on); A.play('clicker', { pos: V(LY.LECTERN.x, 1.1, LY.LECTERN.z), gain: 0.4 }); if (d.on) { this._bootT = 0; A.loop('projectorFan', { pos: V(LY.PROJECTOR.x, LY.PROJECTOR.y, LY.PROJECTOR.z), gain: 0.25, bus: 'room' }); } break;
      case 'clicker': this.profView.clickerPress(); A.play('clicker', { pos: this.profView.head, gain: 0.35 }); break;
      case 'fx': this._fx(d); break;
      case 'phase': H.setClock(this._hm(), PHASE_KEYS[d.phase] || d.phase, this._secTitle); if (d.phase === 'break') A.loop('murmur', { gain: 0.95, bus: 'room' }); else if (d.phase === 'part2') A.loop('murmur', { gain: 0.45, bus: 'room' }); break;
      case 'section': if (Math.random() < 0.35) A.play('throatClear', { pos: this.profView.head, gain: 0.5 }); this._secTitle = d.title; this.notesLines.set(d.id, (d.notes || []).slice()); this.os.dirty = true; break;
      case 'quizIntro': A.play('quizSting', { bus: 'ui', gain: 0.4 }); break;
      case 'quizOpen': this._quizOpen(d); break;
      case 'quizResult': H.quizResult(d, this._quizData || {}); A.play(d.result === 'right' ? 'good' : 'sting', { bus: 'ui', gain: 0.35 }); break;
      case 'caught': this._caught(d); break;
      case 'moveSeat': this._moveSeat(d); break;
      case 'tttMove': this.os.dirty = true; if (d.who === 'O') A.play('ttPlace', { bus: 'player', gain: 0.18, rate: 0.8 }); break;
      case 'tttOver': this.os.dirty = true; if (d.winner === 'X') { A.play('ttWin', { bus: 'player', gain: 0.3 }); H.toast(t('hud.winToast', { p: Math.round(100 * seatMultiplier(S.seat.row)), w: S.ttt.stats.wins, target: S.target }), 'good'); } else if (d.winner === 'O') A.play('ttLose', { bus: 'player', gain: 0.3 }); H.setScore(S.ttt, S.target); break;
      case 'tttRound': this.os.dirty = true; H.setScore(S.ttt, S.target); break;
      case 'chat': this.os.addChat(d.from, d.text); break;
      case 'neighborGlance': W.crowd.neighborGlance(); break;
      case 'neighborWarn': W.crowd.neighborWhisper(); break;
      case 'tutorPos': W.crowd.tutorShow(true); this._tutorPos = d.pos; break;
      case 'tutorDone': W.crowd.tutorShow(false); this._tutorPos = null; break;
      case 'listMove': this._listMove(d); break;
      case 'listSigned': H.toast(t('hud.signed'), 'good'); break;
      case 'hint': if (this.hintsOn) H.hint(d.id, { key: this._keyName('toggleLaptop'), notes: this._keyName('notes'), tab: this._keyName('altTab'), lid: this._keyName('lid'), sign: this._keyName('sign') }); break;
      case 'opponentCaught': W.crowd.lookAll(W.crowd.byId.get(W.plan.opponent.id)?.c.headWorld(V()) || V(), 3, 0.7); H.toast(t('hud.oppCaught'), 'warn'); break;
      case 'prof:chalkStop': this.board.paused = true; break;
      case 'prof:chalkResume': case 'prof:bluff': this.board.paused = false; break;
      case 'prof:shoulder': this.board.paused = true; break;
      case 'end': this._end(d); break;
    }
  }
  _keyName(a) { const k = (this.input.keys[a] || [])[0] || ''; return k.replace(/^Key/, '').replace('Space', t('key.space')).replace('Tab', 'Tab'); }
  _say(d) {
    const S = this.session, W = this.world, A = this.audio;
    const sp = d.speaker || 'prof';
    let pos = null;
    if (sp === 'prof') {
      const dur = A.speak(d.text, { gain: d.kind === 'whisper' ? 0.5 : 0.95 });
      this.speech = { start: this.t, est: dur };
      this.profView.say(d.dur || dur);
      if (d.kind === 'alert') this.player.startle = 1;
    } else {
      if (sp === 'neighbor') pos = W.crowd.byId.get(W.plan.neighbor.id)?.c.headWorld(V());
      else if (sp === 'student' && d.who) pos = W.crowd.byId.get(d.who)?.c.headWorld(V());
      else if (sp === 'tutor') pos = W.crowd.tutor.headWorld(V());
      const female = sp === 'neighbor' || sp === 'tutor' || (d.who && W.crowd.byId.get(d.who)?.s.female);
      A.voice(d.text, { pos, gain: d.kind === 'whisper' ? 0.55 : 0.7, whisper: d.kind === 'whisper', f0: female ? 205 : 125, dur: d.dur });
    }
    this.hud.say(sp, d.text, d.dur || 2, d.kind);
  }
  _slide(d) {
    const W = this.world, sr = W.fx.slides, meta = SLIDE_META[this.lang];
    let ok = true;
    switch (d.kind) {
      case 'content': { const s = this._sec(d.section); const sl = s && s.slides[d.index]; if (sl) sr.content(meta, sl, d.no, d.total, this.lang); else ok = false; break; }
      case 'title': sr.title(meta, { title: t('slide.title'), sub: t('slide.sub'), who: t('lv.lecturerV'), when: t('slide.when') }); break;
      case 'agenda': sr.agenda(meta, t('slide.agenda'), d.agenda || [], d.current ?? -1, d.no, d.total); break;
      case 'break': sr.message(meta, t('slide.break'), t('slide.breakSub')); break;
      case 'end': sr.message(meta, t('slide.end'), t('slide.endSub')); break;
      case 'nosignal': sr.noSignal(t('slide.nosignal')); this._noSignal = true; break;
      case 'restore': this._noSignal = false; if (this.lastSlide) { this._slide(this.lastSlide); return; } break;
      case 'boot': sr.boot(t('slide.boot'), 1); break;
      case 'desktop': sr.desktop(meta, this._hm()); break;
      default: ok = false;
    }
    if (d.kind !== 'nosignal' && d.kind !== 'restore' && ok) this.lastSlide = d;
    if (ok && d.kind === 'content') W.fx.beamer.level *= 0.55; // kurzer Blend beim Folienwechsel
    if (this._bootT !== undefined && this._bootT < 2.5) return; // Beamer fährt noch hoch – Folie erscheint danach
    if (ok) W.fx.updateSlideTextures();
  }
  _board(d) {
    const W = this.world, B = this.board;
    if (d.action === 'slide') {
      W.fx.slideBoards(); this.profView.boardPush(2.2);
      this.audio.play('boardSlide', { pos: V(LY.BOARD.x, 1.8, LY.ROOM.z0 + 0.1), gain: 0.8 });
      // eingehender Flügel noch beschrieben? → wischen
      const inc = W.fx.lowPanel(); if (inc.chalk.cursorY > 0.3) inc.chalk.startWipe(3);
      return;
    }
    if (d.action === 'wipe') { W.fx.lowPanel().chalk.startWipe(3); this.profView.wipe(3); this.audio.play('sponge', { pos: V(LY.BOARD.x, 1.5, LY.ROOM.z0 + 0.1), gain: 0.6 }); return; }
    if (d.action === 'write') {
      const panel = W.fx.lowPanel();
      const job = panel.chalk.write(d.lines, {});
      B.panel = panel; B.job = job; B.delay = d.delay || 0; B.speed = job.total / Math.max(1.5, d.duration * 0.82);
      B.deadline = this.t + (d.delay || 0) + d.duration * 1.8 + 4;
    }
  }
  _updateBoard(dt) {
    const W = this.world, B = this.board, L = this.session.prof;
    W.updateBoards(dt);
    for (const p of W.fx.panels) {
      const writingHere = p === B.panel;
      let pen = null;
      if (writingHere) {
        if (B.delay > 0) { B.delay -= dt; }
        else {
          const canWrite = !L.walking && !B.paused && (L.activity === 'write' || L.activity === 'board' || p.chalk.wipe);
          pen = p.chalk.update(canWrite ? dt : 0, B.speed || 600);
        }
      } else if (p.chalk.wipe) pen = p.chalk.update(dt, 600);
      else p.chalk.update(0, 0);
      if (pen && p.chalk.wipe) B.wipePen = W.fx.penWorld(p, pen, B.wipePen || V());
      if (pen && writingHere) {
        B.penWorld = W.fx.penWorld(p, pen, B.penWorld || V());
        L.penOverride = B.penWorld;
        // Kreidegeräusch
        B.scratch -= dt;
        if (p.chalk.penDown && B.scratch <= 0 && !p.chalk.wipe) { B.scratch = 0.09 + Math.random() * 0.07; this.audio.play(Math.random() < 0.3 ? 'chalkTap' : 'chalkScratch', { pos: B.penWorld, gain: 0.55, ref: 2 }); }
      }
    }
    if (B.panel && !B.panel.chalk.busy) { L.penOverride = null; B.penWorld = null; }
  }
  _fx(d) {
    const W = this.world, A = this.audio, C = W.crowd;
    const st = d.who ? C.byId.get(d.who) : null;
    const spos = st ? st.c.headWorld(V()) : null;
    switch (d.kind) {
      case 'micThump': A.play('micThump', { gain: 0.6 }); break;
      case 'micFeedback': A.play('micFeedback', { gain: 0.35 }); C.lookAll(V(LY.LECTERN.x, 2.5, LY.LECTERN.z), 1.5, 0.5); break;
      case 'latecomer': A.play('doorOpen', { pos: V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1, LY.BACK_DOOR.z), gain: 0.8 }); C.latecomerEnter(); setTimeout(() => A.play('doorClose', { pos: V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1, LY.BACK_DOOR.z), gain: 0.6 }), 2500); C.lookAll(V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1.6, LY.BACK_DOOR.z), 2.5, 0.6); this._lateT = 0; break;
      case 'handRaise': C.handRaise(d.who, true); break;
      case 'handDown': C.handRaise(d.who, false); break;
      case 'phoneRing': if (spos) { A.play('phoneRing', { pos: spos, gain: 0.7 }); C.lookAll(spos, 3, 0.8, st); } break;
      case 'attendanceStart': break;
      case 'attendanceCollect': W.props.listTo('table'); break;
      case 'laugh': C.laugh(); for (let i = 0; i < 5; i++) A.play('laughSoft', { pos: V(-3 + Math.random() * 6, 1.4, -1 + Math.random() * 6), gain: 0.35, delay: Math.random() * 0.5 }); break;
      case 'drink': W.props.table.glass.visible = false; setTimeout(() => { W.props.table.glass.visible = true; }, 6500); A.play('glass', { pos: this.profView.head, gain: 0.4, delay: 1 }); break;
      case 'blinds': W.blinds.set(d.window ?? 0, d.value ?? 0.85); A.play('boardSlide', { pos: V(LY.ROOM.x0, 3.5, LY.WINDOWS.list[d.window || 0]), gain: 0.25, rate: 1.6 }); break;
      case 'rain': W.outside.startRain?.(); A.loop('rain', { pos: V(LY.ROOM.x0 - 1, 2.5, 0), gain: 0.4, bus: 'room', fade: 6 }); C.lookAll(V(LY.ROOM.x0 - 4, 2.5, 0), 2, 0.4); break;
      case 'doorBang': A.play('doorBang', { pos: V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1, LY.BACK_DOOR.z + 0.5), gain: 0.9 }); C.lookAll(V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1.6, LY.BACK_DOOR.z), 2, 0.85); this.player.startle = 0.6; break;
      case 'leave': C.studentLeave(d.who); if (spos) A.play('zipper', { pos: spos, gain: 0.5 }); break;
      case 'coughFit': if (spos) for (let i = 0; i < 6; i++) A.play(i % 2 ? 'cough' : 'coughHigh', { pos: spos, gain: 0.55, delay: i * 0.45 + Math.random() * 0.2 }); break;
      case 'flicker': W.light.setFlickerBurst(); break;
      case 'bottleDrop': if (spos) { A.play('bottleDrop', { pos: spos.clone().setY(spos.y - 1), gain: 0.8 }); C.lookAll(spos, 2, 0.7, st); } break;
      case 'tutorPass': A.play('doorOpen', { pos: V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1, LY.BACK_DOOR.z), gain: 0.4 }); break;
      case 'phoneVibratePlayer': A.play('phoneVibrate', { bus: 'player', gain: 0.6 }); this.hud.toast(t('hud.vibrate')); this.phoneBuzz = 1.6; break;
      case 'breakStart': C.breakStart(W.plan.students.filter((s, i) => i % 3 === 0 && !s.role).map(s => s.id)); this.os.deliverMail('exkursion'); break;
      case 'breakEnd': C.breakEnd(); break;
      case 'knock': A.play('doorOpen', { pos: V(LY.FRONT_DOOR.x, 1.2, LY.FRONT_DOOR.z), gain: 0.3, rate: 1.8 }); for (let i = 0; i < 3; i++) A.play('chalkTap', { pos: V(LY.FRONT_DOOR.x, 1.3, LY.FRONT_DOOR.z), gain: 0.9, rate: 0.5, delay: i * 0.22 }); C.lookAll(V(LY.FRONT_DOOR.x, 1.6, LY.FRONT_DOOR.z), 2, 0.6); break;
      case 'aisle': break;
    }
  }
  _listMove(d) {
    const W = this.world;
    if (d.holder === 'player') {
      const ps = this.session.seatInfo;
      W.props.listTo({ pos: W.props.deskSpot(ps.row, ps.x + 0.18, 0.02), yaw: 0.3 });
      this.audio.play('pageTurn', { pos: W.props.deskSpot(ps.row, ps.x - 0.5, 0), gain: 0.5 });
      this.hud.toast(t('hud.listHere', { key: this._keyName('sign') }));
    } else if (d.holder === 'after') { W.props.listTo(null); if (d.missed) this.hud.toast(t('hud.listMissed'), 'warn'); }
    else { const s = W.plan.students.find(x => x.id === d.holder); if (s) W.props.listTo({ pos: W.props.deskSpot(s.seat.row, s.seat.x - 0.12, 0.02), yaw: -0.4 + Math.random() * 0.8 }); }
  }
  _quizOpen(q) {
    this._quizData = q;
    this.player.startle = 1;
    this.player.lookAtPoint(this.profView.head, 1.6);
    this.world.crowd.lookAll(this.session.player.head.clone(), 2.6, 0.45); // einige drehen sich zu dir um
    const notes = this.session.player.notes[q.section] || 0;
    this.hud.quiz(q, { canPeek: notes >= 0.25, answer: i => this.session.answerQuiz(i), peek: () => this._peek() });
    this.input.exitLock(); this._quizUnlocked = true;
  }
  _caught(d) {
    this.hud.caught(d.strike, d.text, d.kick, d.move);
    this.hud.setStrikes(Math.min(3, d.strike));
    this.player.startle = 1; this.player.shake = 1.2;
    this.player.lookAtPoint(this.profView.head, 3.2); // erschrocken aufschauen
    this.audio.play('sting', { bus: 'ui', gain: 0.5 });
    this.world.crowd.lookAll(this.session.player.head.clone(), 3.5, 0.75);
    this.profView.caught(4);
    this.lidTarget = 108;
  }
  _moveSeat(d) {
    // Umsetzen in die erste Reihe: Laptop, Heft und eigener Körper wandern mit
    const S = this.session, W = this.world, P = W.props.player;
    const s = S.seatInfo;
    const oldS = this.player.seatInfo;
    const dx = s.x - oldS.x, dz = LY.rowFront(s.row) - LY.rowFront(oldS.row), dy = LY.rowFloor(s.row) - LY.rowFloor(oldS.row);
    for (const g of [P.laptop.group, P.notebook.group, P.phone]) { const m = new THREE.Matrix4().makeTranslation(dx, dy + 0, dz); g.matrix.premultiply(m); g.matrixWorldNeedsUpdate = true; }
    // Neigung bleibt gleich (alle Reihen haben dieselbe Pultneigung); Höhe: Fläche verschiebt sich um dy (Reihenboden) – passt
    this.player.seat(s);
    this.hud.toast(t('hud.movedFront'), 'warn');
  }
  _end(res) {
    if (this.ended) return; this.ended = true;
    this.audio.stopSpeech(); this.audio.stopLoops(1.5);
    this.hud.quizClose();
    setTimeout(() => this.onEnd?.(res), res.reason === 'kicked' ? 2600 : 1800);
  }
  abort() { this.ended = true; this.audio.stopSpeech(); this.audio.stopLoops(0.3); }
  /** Zufällige Raumgeräusche aus dem Saal (positioniert): Husten, Knarzen, Blättern, Kuli, Reißverschluss */
  _ambience(dt, pv) {
    const W = this.world, A = this.audio, S = this.session;
    this._ambT = (this._ambT ?? 2) - dt;
    if (this._ambT <= 0) {
      this._ambT = 1.2 + Math.random() * (S.director.phase === 'break' ? 1.5 : 3.5);
      const list = W.crowd.list.filter(x => x.present && x.c.visible); if (!list.length) return;
      const st = list[Math.floor(Math.random() * list.length)], pos = st.c.headWorld(V());
      const r = Math.random();
      const name = r < 0.12 ? (Math.random() < 0.5 ? 'cough' : 'throatClear') : r < 0.35 ? 'chairCreak' : r < 0.55 ? 'pageTurn' : r < 0.7 ? 'penClick' : r < 0.78 ? 'zipper' : r < 0.9 ? 'cloth' : 'seatFlip';
      A.play(name, { pos: name === 'chairCreak' || name === 'seatFlip' ? pos.clone().setY(pos.y - 0.6) : pos, gain: 0.35 + Math.random() * 0.25 });
    }
    // eigener Sitz knarzt bei schnellen Kopfbewegungen; Stoff raschelt beim Umdrehen
    const v = Math.abs((this.player.yaw - (this._lastYaw ?? this.player.yaw)) / Math.max(dt, 1e-3)); this._lastYaw = this.player.yaw;
    this._clothT = (this._clothT || 0) - dt;
    if (v > 2.2 && this._clothT <= 0) { this._clothT = 1.2; A.play(Math.random() < 0.4 ? 'chairCreak' : 'cloth', { bus: 'player', gain: 0.25 }); }
    // draußen: Vögel bei Sonne
    this._birdT = (this._birdT ?? 8) - dt;
    if (this._birdT <= 0) { this._birdT = 10 + Math.random() * 25; if (this.cfg.weather === 'sunny') A.play('bird', { pos: V(LY.ROOM.x0 - 8, 3, -4 + Math.random() * 10), gain: 0.18 }); }
    void pv;
  }
  // ------------------------------------------------------------------ Frame
  update(dt, time) {
    const S = this.session, W = this.world, A = this.audio, H = this.hud, p = S.player;
    const look = this.handleInput(dt);
    if (this.paused) return;
    this.t += dt;
    // verzögertes Alt-Tab (Reflex dauert)
    if (this.altTabT > 0 && (this.altTabT -= dt) <= 0) { this.os.altTab(); S.appSwitched(); }
    // Laptop-Zustand an die Logik
    if (Math.abs(this.lidTarget - this.lid) > 4 && !this._hingeOn) { this._hingeOn = true; A.play('hinge', { bus: 'player', gain: 0.35, rate: this.lidTarget > this.lid ? 1 : 0.85 }); }
    if (Math.abs(this.lidTarget - this.lid) < 1) this._hingeOn = false;
    this.lid = damp(this.lid, this.lidTarget, 9, dt);
    W.props.player.laptop.setLid(this.lid);
    this.lidMoveT -= dt; this.mouseMoveT -= dt; this.typingT -= dt;
    S.laptop({ lid: this.lid, brightness: this.brightness, app: this.os.app, luma: this.os.luma ?? 0.3 });
    // Logik
    if (this.bot && !this.ended) this.bot.update(dt);
    if (!this.ended) S.step(dt);
    // Spieler (Kamera)
    const frozen = S.caughtSeq != null;
    const pv = this.player.update(dt, time, { dx: look.dx, dy: look.dy, frozen, cursor: this.cursor, clicked: this.clicked, typing: this.typingT > 0, mouseMoving: this.mouseMoveT > 0, lidMoving: this.lidMoveT > 0, stress: this.settings.reducedMotion ? 0 : S.susp.stress });
    this.clicked = false;
    if (this.bot) { this.player.yaw = S.player.headYaw; this.player.pitch = clamp(S.player.headPitch, -0.9, 0.5); } // Autopilot bewegt den Kopf
    else S.setHead(this.player.headYaw, this.player.headPitch, dt);
    // Tafel, Prof, Studierende
    this._updateBoard(dt);
    this.profView.update(dt, time, this.board.penWorld, this.board.wipePen);
    W.crowd.update(dt, time, { profHead: this.profView.head, playerHead: pv.eye, camPos: pv.eye, oppTyping: S.opp.typing, oppWaiting: S.opp.waiting, playerLaptop: W.props.player.laptop.screenWorld(0.5, 0.5), tutorPos: this._tutorPos });
    W.props.update(dt, time);
    this._ambience(dt, pv);
    if (this.phoneBuzz > 0) { this.phoneBuzz -= dt; const ph = W.props.player.phone; if (!ph.userData.m0) ph.userData.m0 = ph.matrix.clone(); ph.matrix.copy(ph.userData.m0).multiply(new THREE.Matrix4().makeRotationY(Math.sin(time * 90) * 0.04 * Math.max(0, this.phoneBuzz))); ph.matrixWorldNeedsUpdate = true; }
    // Mitschrift: beim Schreiben füllt sich das Heft mit den Notizen des Abschnitts
    const nb = W.props.player.notebook;
    if (p.mode === 'notes' && p.blend < 0.2 && nb.queue.length === 0 && !nb.job) {
      const sec = S.director.currentSection; const lines = sec && this.notesLines.get(sec.sec.id);
      if (lines && lines.length) nb.add([lines.shift()]); else if (sec && !this._notesHead?.[sec.sec.id]) { (this._notesHead ||= {})[sec.sec.id] = 1; nb.add(['— ' + (this._secTitle || '') + ' —']); }
    }
    const writing = nb.update(dt, p.mode === 'notes' && this.player.notesBlend > 0.7, 300);
    if (writing && Math.random() < dt * 5) A.play('penWrite', { bus: 'player', gain: 0.25 });
    // Laptop-Bildschirm
    this.os.brightness = this.brightness; this.os.muted = p.muted;
    const visible = this.lid > 40;
    if (this.os.update(dt, visible)) this.osTex.needsUpdate = true;
    const scrMat = W.props.player.laptop.screenMat;
    const lidF = smoothstep(55, 95, this.lid);
    scrMat.color.setScalar(Math.min(1.6, (0.25 + this.brightness * 0.95) * lidF * (1 + (this.os.flicker || 0) * 0.25)));
    W.light.laptopGlow.intensity = this.brightness * lidF * (0.25 + (this.os.luma || 0.3) * 0.6) * 1.2;
    W.light.laptopGlow.position.copy(W.props.player.laptop.screenWorld(0.5, 0.5)).addScaledVector(W.props.player.laptop.screenNormal(V()), 0.35);
    // Welt
    W.light.update(dt, time); W.outside.update(dt, time, (ev) => { if (ev === 'stop') A.play('tramBell', { pos: V(LY.ROOM.x0 - 18, -10, 10), gain: 0.2, rate: 0.7 }); });
    W.blinds.update(dt); W.fx.updateBeamer(dt); W.monitor.update(dt); W.details.update(dt);
    if (this._bootT !== undefined && this._bootT < 2.5) {
      this._bootT += dt;
      if (this._bootT < 2.5) { W.fx.slides.boot(t('slide.boot'), this._bootT); W.fx.updateSlideTextures(); }
      else if (this.lastSlide) this._slide(this.lastSlide);
      else { W.fx.slides.desktop(SLIDE_META[this.lang], this._hm()); W.fx.updateSlideTextures(); }
    }
    W.fx.setClock(S.director.clockMinutes());
    // Spätkommer:in: Laptop erscheint mit dem Hinsetzen
    if (this._lateT !== undefined) { this._lateT += dt; if (this._lateT > 12 && W.lateLaptop) { W.lateLaptop.visible = true; this._lateT = undefined; } }
    // Mails zeitversetzt
    if (this.mailPlan.length && S.t > this.mailPlan[0][0]) this.os.deliverMail(this.mailPlan.shift()[1]);
    // Audio: Zuhörer, Dämpfung, Herzschlag
    const cam = this.gfx.camera, fwd = V(0, 0, -1).applyQuaternion(cam.quaternion), up = V(0, 1, 0).applyQuaternion(cam.quaternion);
    A.setListener(cam.position, fwd, up);
    A.setMuffle(p.blend * 0.6, p.headphones);
    const stress = S.susp.stress;
    this._heartT = (this._heartT || 0) - dt;
    if (stress > 0.45 && this._heartT <= 0 && !this.ended) { this._heartT = lerp(0.95, 0.5, (stress - 0.45) / 0.55); A.play('heart', { bus: 'player', gain: (stress - 0.4) * 0.9 }); if (!this.settings.reducedMotion && !this.settings.photosensitive) this.gfx.pulse = Math.min(1, stress); }
    this._breathT = (this._breathT || 4) - dt;
    if (stress > 0.7 && this._breathT <= 0 && !this.ended) { this._breathT = 3.5 + Math.random() * 2; A.play('breath', { bus: 'player', gain: 0.35 }); }
    this.gfx.setStress(this.settings.reducedMotion ? stress * 0.5 : stress);
    // Tiefenschärfe: am Laptop nah, sonst Prof
    if (this.settings.dof) this.gfx.setFocus(p.blend > 0.5 || this.player.notesBlend > 0.5, this.player.focusDist || 0.4, 0.45); else this.gfx.setFocus(false);
    // HUD
    H.setClock(this._hm(), S.director.phase, this._secTitle);
    H.setSuspicion(S.susp.attention, S.susp.suspicion, S.susp.evidence, S.lastVis.vis > 0.3);
    H.setMode(p.mode, { key: this._keyName('toggleLaptop'), notes: this._keyName('notes') });
    // Untertitel: am Laptop/mit Kopfhörern verwaschen, hinten etwas undeutlicher; Linsenstaub bei Stress
    H.setMuffle(clamp(p.blend * 0.55 + (p.headphones ? 0.45 : 0) + Math.max(0, S.seat.row - 6) * 0.06, 0, 1));
    H.setDirt(this.settings.photosensitive || this.settings.reducedMotion ? 0 : Math.max(0, stress - 0.5) * 0.8);
    H.setStrikes(Math.min(3, S.stats.strikes));
    if (S.quiz && !S.quiz.answered) H.quizTimer(S.quiz.time / S.quiz.total);
    if (this._quizUnlocked && !S.quiz) { this._quizUnlocked = false; }
    // Hinweis: Liste unterschreiben
    const L = S.list;
    H.prompt(L && L.holder === 'player' && !L.signed ? (L.signing > 0 ? t('hud.signing') : t('hud.signPrompt', { key: this._keyName('sign') })) : null);
    if (this.debug) H.debug(true, `att ${S.susp.attention.toFixed(0)}  sus ${S.susp.suspicion.toFixed(0)}  ev ${S.susp.evidence.toFixed(0)}\nvis ${S.lastVis.vis.toFixed(2)} fov ${S.lastVis.fovea.toFixed(2)} los ${S.lastVis.los}\nprof ${S.prof.activity} ${S.prof.face.mode} sh${S.prof.shoulder.phase}\nphase ${S.director.phase} t ${S.t.toFixed(0)}/${S.seconds}\n${JSON.stringify(this.gfx.stats())}`);
    else H.debug(false);
  }
  /** Bild-in-Bild aus Sicht des Profs (F3, Debug) */
  renderPiP() {
    if (!this.debug) return;
    const r = this.gfx.renderer, S = this.session;
    const cam = this._pipCam || (this._pipCam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 60));
    const e = S.prof.eye(V()), g = S.prof.gazeDir(V());
    cam.position.copy(e); cam.lookAt(e.clone().add(g));
    const w = Math.round(r.domElement.width * 0.28), h = Math.round(w * 9 / 16);
    r.setScissorTest(true); r.setScissor(16, 16, w, h); r.setViewport(16, 16, w, h);
    const vis = this.profView.rig.mesh.visible; this.profView.rig.mesh.visible = false;
    const head = this.player.rig.bones.head; head.scale.setScalar(1);
    r.render(this.gfx.scene, cam);
    head.scale.setScalar(0.001);
    this.profView.rig.mesh.visible = vis;
    r.setScissorTest(false); r.setViewport(0, 0, r.domElement.width, r.domElement.height);
  }
}
