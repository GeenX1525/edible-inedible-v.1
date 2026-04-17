(() => {
  const STORAGE_KEY = 'edible-inedible.v1';

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { bestScore: 0, bestLevel: 1, played: 0 };
      const parsed = JSON.parse(raw);
      return {
        bestScore: Number(parsed.bestScore) || 0,
        bestLevel: Number(parsed.bestLevel) || 1,
        played: Number(parsed.played) || 0,
      };
    } catch {
      return { bestScore: 0, bestLevel: 1, played: 0 };
    }
  }

  function saveStats(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / privacy mode
    }
  }

  function updateBestIfNeeded(score, level) {
    const stats = loadStats();
    const next = {
      ...stats,
      played: stats.played + 1,
      bestScore: Math.max(stats.bestScore, score),
      bestLevel: Math.max(stats.bestLevel, level),
    };
    saveStats(next);
    return next;
  }

  // Game Configuration
  const CONFIG = {
    initialLives: 10,
    pointsPerLevel: [20, 35, 50, 65, 80],
    comboThreshold: 5,
    comboBonus: 3,
    maxObjects: {
      1: 3,
      2: 5,
      3: 8,
      4: 12,
      5: 15,
    },
  };

  // Game State
  let state = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    lives: CONFIG.initialLives,
    level: 1,
    combo: 0,
    correctStreak: 0,
    objects: [],
    particles: [],
    bonuses: [],
    activeBonus: null,
    soundEnabled: true,
    shieldActive: false,
    targetScore: CONFIG.pointsPerLevel[0],
    lastSpawn: 0,
    spawnInterval: 2000,
    gameTime: 0,
  };

  // Canvas Setup
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let animationId;

  // Resize canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Level Configurations
  const levels = {
    1: {
      name: 'Бабушкин огород',
      bg: 'linear-gradient(to bottom, #87CEEB 0%, #90EE90 100%)',
      objects: [
        { emoji: '🥕', edible: true, name: 'морковка' },
        { emoji: '🍎', edible: true, name: 'яблоко' },
        { emoji: '🍅', edible: true, name: 'помидор' },
        { emoji: '🚿', edible: false, name: 'лейка' },
        { emoji: '🚧', edible: false, name: 'забор' },
        { emoji: '🔴', edible: false, name: 'мяч' },
      ],
      speed: 1.5,
      rotation: false,
    },
    2: {
      name: 'Безумный супермаркет',
      bg: 'linear-gradient(to bottom, #FFE4B5 0%, #DEB887 100%)',
      objects: [
        { emoji: '🥛', edible: true, name: 'молоко' },
        { emoji: '🥖', edible: true, name: 'батон' },
        { emoji: '🧼', edible: false, name: 'мыло', trap: true, looksLike: 'зефир' },
        { emoji: '🧴', edible: false, name: 'шампунь' },
        { emoji: '🧽', edible: false, name: 'губка' },
        { emoji: '🥓', edible: true, name: 'колбаса' },
        { emoji: '🍦', edible: true, name: 'мороженое' },
        { emoji: '🧾', edible: false, name: 'чек' },
        { emoji: '🛒', edible: false, name: 'корзинка' },
        { emoji: '🍎', edible: false, name: 'игрушечный фрукт', trap: true },
      ],
      speed: 2.5,
      rotation: true,
    },
    3: {
      name: 'Пикник в лесу',
      bg: 'linear-gradient(to bottom, #228B22 0%, #8FBC8F 100%)',
      objects: [
        { emoji: '🥪', edible: true, name: 'бутерброд' },
        { emoji: '🫐', edible: true, name: 'ягоды' },
        { emoji: '🍄', edible: true, name: 'гриб' },
        { emoji: '🍄', edible: false, name: 'поганка', trap: true },
        { emoji: '👟', edible: false, name: 'кроссовок' },
        { emoji: '🌲', edible: false, name: 'шишка' },
        { emoji: '🥕', edible: true, name: 'морковка' },
        { emoji: '🍎', edible: true, name: 'яблоко' },
      ],
      speed: 3,
      rotation: true,
      visualNoise: true,
    },
    4: {
      name: 'Молекулярная кухня',
      bg: 'linear-gradient(to bottom, #191970 0%, #483D8B 100%)',
      objects: [
        { emoji: '🫧', edible: true, name: 'пена', looksLike: 'мыло' },
        { emoji: '🔮', edible: false, name: 'сфера', looksLike: 'желе' },
        { emoji: '🧪', edible: false, name: 'колба', looksLike: 'напиток' },
        { emoji: '🧊', edible: true, name: 'сухой лед', looksLike: 'кубик льда' },
        { emoji: '🥛', edible: true, name: 'молоко' },
        { emoji: '🧼', edible: true, name: 'зефир', looksLike: 'мыло', trap: true },
        { emoji: '🍎', edible: false, name: 'восковое яблоко', trap: true },
      ],
      speed: 4,
      rotation: true,
      erratic: true,
    },
    5: {
      name: 'Космический фуршет',
      bg: 'linear-gradient(to bottom, #000428 0%, #004e92 100%)',
      objects: [
        { emoji: '🧃', edible: true, name: 'тюбик с едой' },
        { emoji: '☄️', edible: false, name: 'астероид' },
        { emoji: '⭐', edible: false, name: 'звезда' },
        { emoji: '👽', edible: true, name: 'инопланетный фрукт' },
        { emoji: '🥕', edible: true, name: 'морковка' },
        { emoji: '🥛', edible: true, name: 'молоко' },
        { emoji: '🫧', edible: true, name: 'космическая пена' },
        { emoji: '🌑', edible: false, name: 'черная дыра' },
      ],
      speed: 5,
      rotation: true,
      gravityInvert: true,
    },
  };

  // Bonus Types
  const bonusTypes = [
    { id: 'goldenMouth', emoji: '👑', name: 'Золотой рот', duration: 5000, color: '#FFD700' },
    { id: 'freeze', emoji: '❄️', name: 'Заморозка', duration: 5000, color: '#00CED1' },
    { id: 'magnet', emoji: '🧲', name: 'Магнит', duration: 3000, color: '#DC143C' },
    { id: 'xray', emoji: '🔍', name: 'Рентген', duration: 5000, color: '#32CD32' },
    { id: 'shield', emoji: '🛡️', name: 'Щит', duration: -1, color: '#4169E1' },
  ];

  // Audio Context for sound effects
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();

  function playSound(type) {
    if (!state.soundEnabled) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    switch (type) {
      case 'eat':
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
        break;
      case 'avoid':
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
        break;
      case 'error':
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
        break;
      case 'bonus':
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
        break;
      case 'combo':
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
        break;
      case 'levelUp':
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(554, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
        break;
      default:
        break;
    }
  }

  // Particle System
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 10;
      this.vy = (Math.random() - 0.5) * 10;
      this.life = 1;
      this.color = color;
      this.size = Math.random() * 5 + 3;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.5;
      this.life -= 0.02;
      this.size *= 0.98;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function createParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) state.particles.push(new Particle(x, y, color));
  }

  // Game Object Class
  class GameObject {
    constructor() {
      const level = levels[state.level];
      const config = level.objects[Math.floor(Math.random() * level.objects.length)];

      this.emoji = config.emoji;
      this.edible = config.edible;
      this.name = config.name;
      this.trap = config.trap || false;
      this.looksLike = config.looksLike || null;

      this.size = Math.random() * 20 + 40;
      this.x = Math.random() * (canvas.width - this.size * 2) + this.size;
      this.y = -this.size;

      const speedMultiplier = state.activeBonus?.id === 'freeze' ? 0.3 : 1;
      this.speedY = (level.speed + Math.random()) * speedMultiplier;
      this.speedX = level.erratic ? (Math.random() - 0.5) * 2 : 0;

      if (level.gravityInvert && Math.random() > 0.5) {
        this.y = canvas.height + this.size;
        this.speedY = -this.speedY;
      }

      this.rotation = 0;
      this.rotationSpeed = level.rotation ? (Math.random() - 0.5) * 0.1 : 0;

      this.opacity = level.visualNoise ? 0.6 + Math.random() * 0.4 : 1;
      this.scale = 1;

      this.clicked = false;
      this.magnetized = false;
    }

    update() {
      if (this.magnetized) {
        const dx = canvas.width / 2 - this.x;
        const dy = canvas.height / 2 - this.y;
        this.x += dx * 0.1;
        this.y += dy * 0.1;
        this.scale *= 0.9;
      } else {
        this.y += this.speedY;
        this.x += this.speedX;
        if (this.x < this.size || this.x > canvas.width - this.size) this.speedX *= -1;
      }

      this.rotation += this.rotationSpeed;

      if (levels[state.level].erratic && Math.random() < 0.02) this.speedY *= -1;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);

      if (state.activeBonus?.id === 'xray') {
        ctx.shadowColor = this.edible ? '#22c55e' : '#ef4444';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = this.edible ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.font = `${this.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.emoji, 0, 0);

      ctx.restore();
    }

    isOffScreen() {
      return this.y > canvas.height + this.size || this.y < -this.size * 2;
    }

    contains(x, y) {
      const dx = x - this.x;
      const dy = y - this.y;
      return Math.sqrt(dx * dx + dy * dy) < this.size / 2;
    }
  }

  class BonusObject extends GameObject {
    constructor() {
      super();
      const bonus = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
      this.bonusType = bonus;
      this.emoji = bonus.emoji;
      this.edible = true;
      this.isBonus = true;
      this.speedY = Math.abs(this.speedY) * 1.5;
    }
  }

  function spawnObject() {
    const now = Date.now();
    if (now - state.lastSpawn < state.spawnInterval) return;

    const maxObjs = CONFIG.maxObjects[state.level] || 5;
    if (state.objects.length >= maxObjs) return;

    if (Math.random() < 0.05) state.objects.push(new BonusObject());
    else state.objects.push(new GameObject());

    state.lastSpawn = now;

    const progress = state.score / state.targetScore;
    state.spawnInterval = Math.max(500, 2000 - progress * 1000 - state.level * 200);
  }

  function activateBonus(bonus) {
    playSound('bonus');

    if (state.activeBonus?.id === bonus.id) clearTimeout(state.activeBonus.timeout);

    state.activeBonus = { ...bonus, startTime: Date.now() };
    updateActiveBonuses();

    if (bonus.id === 'shield') state.shieldActive = true;

    if (bonus.duration > 0) {
      state.activeBonus.timeout = setTimeout(() => {
        deactivateBonus(bonus.id);
      }, bonus.duration);
    }
  }

  function deactivateBonus(bonusId) {
    if (state.activeBonus?.id !== bonusId) return;
    state.activeBonus = null;
    if (bonusId === 'shield') state.shieldActive = false;
    updateActiveBonuses();
  }

  function updateActiveBonuses() {
    const container = document.getElementById('activeBonuses');
    container.innerHTML = '';

    if (!state.activeBonus) return;

    const bonus = state.activeBonus;
    const elapsed = Date.now() - bonus.startTime;
    const remaining = Math.max(0, bonus.duration - elapsed);
    const percent = bonus.duration > 0 ? (remaining / bonus.duration) * 100 : 100;

    const div = document.createElement('div');
    div.className =
      'bg-black/50 rounded-full px-3 py-1 flex items-center gap-2 border border-white/20 bonus-active';
    div.innerHTML = `
      <span class="text-xl">${bonus.emoji}</span>
      ${
        bonus.duration > 0
          ? `<div class="w-16 h-2 bg-gray-700 rounded-full overflow-hidden"><div class="h-full bg-white transition-all" style="width: ${percent}%"></div></div>`
          : ''
      }
    `;
    container.appendChild(div);
  }

  function showComboPopup() {
    const popup = document.getElementById('comboPopup');
    document.getElementById('comboMultiplier').textContent = state.combo + 1;
    popup.classList.remove('hidden');
    setTimeout(() => popup.classList.add('hidden'), 800);
  }

  function handleError() {
    playSound('error');
    state.lives--;
    state.correctStreak = 0;
    state.combo = 0;

    const container = document.getElementById('gameContainer');
    container.classList.add('shake');
    setTimeout(() => container.classList.remove('shake'), 500);

    createParticles(canvas.width / 2, canvas.height / 2, '#ef4444', 15);

    if (state.lives <= 0) gameOver();
    updateUI();
  }

  function handleClick(x, y) {
    if (!state.isPlaying || state.isPaused) return;

    let hit = false;
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const obj = state.objects[i];
      if (!obj.contains(x, y) || obj.clicked) continue;

      hit = true;
      obj.clicked = true;

      if (obj.isBonus) {
        createParticles(obj.x, obj.y, obj.bonusType.color, 12);
        state.objects.splice(i, 1);
        activateBonus(obj.bonusType);
        return;
      }

      const isGoldenMouth = state.activeBonus?.id === 'goldenMouth';

      if (obj.edible || isGoldenMouth) {
        playSound('eat');
        createParticles(obj.x, obj.y, '#22c55e', 8);
        state.score++;
        state.correctStreak++;

        if (state.correctStreak >= CONFIG.comboThreshold) {
          state.score += CONFIG.comboBonus;
          state.combo++;
          showComboPopup();
          playSound('combo');
          state.correctStreak = 0;
        }

        if (state.activeBonus?.id === 'magnet') {
          state.objects.forEach((other) => {
            if (other.edible && !other.clicked && !other.isBonus) {
              other.magnetized = true;
              setTimeout(() => {
                state.score++;
                createParticles(other.x, other.y, '#22c55e', 5);
              }, 300);
            }
          });
        }
      } else {
        if (state.shieldActive) {
          state.shieldActive = false;
          state.activeBonus = null;
          updateActiveBonuses();
          createParticles(obj.x, obj.y, '#3b82f6', 8);
          playSound('avoid');
        } else {
          handleError();
        }
      }

      state.objects.splice(i, 1);
      updateUI();
      checkLevelProgress();
      return;
    }

    if (!hit) {
      const inedibleCount = state.objects.filter((o) => !o.edible && !o.isBonus).length;
      if (inedibleCount > 0) {
        playSound('avoid');
        state.correctStreak++;
        if (state.correctStreak >= CONFIG.comboThreshold) {
          state.score += CONFIG.comboBonus;
          state.combo++;
          showComboPopup();
          playSound('combo');
          state.correctStreak = 0;
        }
        updateUI();
      }
    }
  }

  function checkLevelProgress() {
    if (state.score < state.targetScore) return;
    if (state.level >= 5) victory();
    else levelUp();
  }

  function levelUp() {
    playSound('levelUp');
    state.level++;
    state.targetScore = CONFIG.pointsPerLevel[state.level - 1] || state.targetScore + 15;

    const modal = document.getElementById('levelCompleteModal');
    document.getElementById('nextLevelName').textContent = levels[state.level].name;
    modal.classList.remove('hidden');

    setTimeout(() => {
      modal.classList.add('hidden');
      updateBackground();
    }, 2000);

    updateUI();
  }

  function updateBackground() {
    const level = levels[state.level];
    document.getElementById('bgLayer').style.background = level.bg;
  }

  function updateUI() {
    document.getElementById('scoreDisplay').textContent = state.score;
    document.getElementById('livesDisplay').textContent = state.lives;
    document.getElementById('levelDisplay').textContent = state.level;
    document.getElementById('levelName').textContent = levels[state.level].name;
    document.getElementById('comboDisplay').textContent = state.combo;

    const progress = Math.min(100, (state.score / state.targetScore) * 100);
    document.getElementById('progressBar').style.width = `${progress}%`;

    const livesBox = document.getElementById('livesDisplay').parentElement;
    if (state.lives <= 3) livesBox.classList.add('heart-beat');
    else livesBox.classList.remove('heart-beat');
  }

  function gameOver() {
    state.isPlaying = false;

    const stats = updateBestIfNeeded(state.score, state.level);
    const bestLine = document.getElementById('bestLine');
    if (bestLine) bestLine.textContent = `Рекорд: ${stats.bestScore} • лучший уровень: ${stats.bestLevel}`;

    document.getElementById('finalScore').textContent = state.score;
    document.getElementById('finalLevel').textContent = state.level;
    document.getElementById('gameOverModal').classList.remove('hidden');
  }

  function victory() {
    state.isPlaying = false;

    const stats = updateBestIfNeeded(state.score, state.level);
    const bestLine = document.getElementById('bestLine');
    if (bestLine) bestLine.textContent = `Рекорд: ${stats.bestScore} • лучший уровень: ${stats.bestLevel}`;

    document.getElementById('victoryScore').textContent = state.score;
    document.getElementById('victoryModal').classList.remove('hidden');
  }

  function resetGame() {
    state = {
      isPlaying: true,
      isPaused: false,
      score: 0,
      lives: CONFIG.initialLives,
      level: 1,
      combo: 0,
      correctStreak: 0,
      objects: [],
      particles: [],
      bonuses: [],
      activeBonus: null,
      soundEnabled: state.soundEnabled,
      shieldActive: false,
      targetScore: CONFIG.pointsPerLevel[0],
      lastSpawn: Date.now(),
      spawnInterval: 2000,
      gameTime: 0,
    };

    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('victoryModal').classList.add('hidden');
    document.getElementById('mainMenu').classList.add('hidden');
    updateBackground();
    updateUI();
    gameLoop();
  }

  function gameLoop() {
    if (!state.isPlaying) return;

    if (!state.isPaused) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      spawnObject();

      state.objects = state.objects.filter((obj) => {
        obj.update();
        obj.draw();

        if (obj.isOffScreen()) {
          if (obj.edible && !obj.isBonus && !obj.magnetized) handleError();
          return false;
        }
        return true;
      });

      state.particles = state.particles.filter((p) => {
        p.update();
        p.draw();
        return p.life > 0;
      });

      if (state.activeBonus && state.activeBonus.duration > 0) updateActiveBonuses();
      state.gameTime += 16;
    }

    animationId = requestAnimationFrame(gameLoop);
  }

  function ensureAudio() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  // Event Listeners
  document.getElementById('startBtn').addEventListener('click', () => {
    ensureAudio();
    resetGame();
  });

  document.getElementById('rulesBtn').addEventListener('click', () => {
    document.getElementById('rulesModal').classList.remove('hidden');
  });

  document.getElementById('closeRulesBtn').addEventListener('click', () => {
    document.getElementById('rulesModal').classList.add('hidden');
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    ensureAudio();
    resetGame();
  });

  document.getElementById('playAgainBtn').addEventListener('click', () => {
    ensureAudio();
    resetGame();
  });

  document.getElementById('pauseBtn').addEventListener('click', () => {
    state.isPaused = true;
    document.getElementById('pauseModal').classList.remove('hidden');
  });

  document.getElementById('resumeBtn').addEventListener('click', () => {
    state.isPaused = false;
    document.getElementById('pauseModal').classList.add('hidden');
  });

  document.getElementById('soundBtn').addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    document.getElementById('soundOn').classList.toggle('hidden');
    document.getElementById('soundOff').classList.toggle('hidden');
  });

  // Mouse/Touch handling
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    handleClick(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      handleClick(touch.clientX - rect.left, touch.clientY - rect.top);
    },
    { passive: false },
  );

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Initialize UI + background
  updateBackground();
  updateUI();

  // Best line on menu
  const initialStats = loadStats();
  const bestLine = document.getElementById('bestLine');
  if (bestLine) bestLine.textContent = `Рекорд: ${initialStats.bestScore} • лучший уровень: ${initialStats.bestLevel}`;

  // Autostart when coming from landing
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    // Delay a tick so layout is ready
    setTimeout(() => {
      ensureAudio();
      resetGame();
    }, 0);
  }
})();

