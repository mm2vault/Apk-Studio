import { Project, AppConfig } from '../types/project';

const STORAGE_KEY = 'apk_studio_mobile_projects_v1';
const ACTIVE_PROJECT_KEY = 'apk_studio_active_project_id';

export const DEFAULT_CONFIG: AppConfig = {
  name: 'Yeni Uygulama',
  packageId: 'com.ornek.uygulamam',
  versionName: '1.0.0',
  versionCode: 1,
  minSdk: 24, // Android 7.0
  targetSdk: 34, // Android 14
  orientation: 'portrait',
  fullscreen: false,
  iconShape: 'squircle',
  permissions: {
    internet: true,
    networkState: true,
    camera: false,
    audioRecord: false,
    locationFine: false,
    locationCoarse: false,
    readStorage: false,
    writeStorage: false,
    vibrate: false,
    custom: []
  },
  webSettings: {
    allowJavaScript: true,
    allowDomStorage: true,
    clearCacheOnExit: false,
    enableZoom: false
  }
};

export const SAMPLE_WEB_PROJECT: Project = {
  id: 'proj_sample_web',
  name: 'Flappy Bird Web',
  description: 'HTML5 Canvas tabanlı mobil oyun prototipi',
  type: 'web-to-apk',
  createdAt: Date.now() - 3600000 * 24,
  updatedAt: Date.now() - 3600000,
  config: {
    ...DEFAULT_CONFIG,
    name: 'Flappy Bird Web',
    packageId: 'com.mobile.flappyweb',
    versionName: '1.0.1',
    versionCode: 2,
    orientation: 'portrait',
    fullscreen: true,
    permissions: {
      ...DEFAULT_CONFIG.permissions,
      internet: true,
      vibrate: true
    }
  },
  cloudConfig: {
    provider: 'github-actions',
    webhookUrl: '',
    apiToken: '',
    autoDeploy: false
  },
  files: [
    {
      id: 'f_index_html',
      name: 'index.html',
      path: 'index.html',
      size: 1420,
      type: 'text/html',
      isBinary: false,
      lastModified: Date.now(),
      content: `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Flappy Bird</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-container">
    <div id="hud">
      <div id="score">0</div>
      <div id="high-score">En Yüksek: 0</div>
    </div>
    <canvas id="gameCanvas" width="360" height="600"></canvas>
    <div id="start-overlay">
      <h1>Flappy Bird</h1>
      <p>Başlamak için ekrana dokunun</p>
      <button id="start-btn">OYNA</button>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>`
    },
    {
      id: 'f_style_css',
      name: 'style.css',
      path: 'style.css',
      size: 890,
      type: 'text/css',
      isBinary: false,
      lastModified: Date.now(),
      content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
  -webkit-user-select: none;
}
body {
  background: #111;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  overflow: hidden;
  font-family: sans-serif;
}
#game-container {
  position: relative;
  width: 360px;
  height: 600px;
  background: #4ec0ca;
  overflow: hidden;
}
#hud {
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 20px;
  color: #fff;
  font-weight: bold;
  text-shadow: 2px 2px #000;
  z-index: 10;
}
#start-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  gap: 16px;
  z-index: 20;
}
#start-btn {
  background: #e67e22;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 24px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
}`
    },
    {
      id: 'f_game_js',
      name: 'game.js',
      path: 'game.js',
      size: 2100,
      type: 'application/javascript',
      isBinary: false,
      lastModified: Date.now(),
      content: `const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');

let bird = { x: 50, y: 250, vy: 0, gravity: 0.35, jump: -6.5, radius: 14 };
let pipes = [];
let score = 0;
let isRunning = false;
let frameCount = 0;

function resetGame() {
  bird.y = 250;
  bird.vy = 0;
  pipes = [];
  score = 0;
  scoreEl.textContent = '0';
  frameCount = 0;
}

function flap() {
  if (!isRunning) return;
  bird.vy = bird.jump;
}

window.addEventListener('pointerdown', () => flap());

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startOverlay.style.display = 'none';
  resetGame();
  isRunning = true;
});

function update() {
  if (!isRunning) return;
  frameCount++;
  bird.vy += bird.gravity;
  bird.y += bird.vy;

  if (bird.y + bird.radius > canvas.height || bird.y - bird.radius < 0) {
    gameOver();
  }

  if (frameCount % 100 === 0) {
    const gap = 130;
    const topHeight = Math.floor(Math.random() * (canvas.height - gap - 100)) + 40;
    pipes.push({ x: canvas.width, top: topHeight, bottom: canvas.height - topHeight - gap, scored: false });
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= 2;
    if (!pipes[i].scored && pipes[i].x < bird.x) {
      score++;
      scoreEl.textContent = score;
      pipes[i].scored = true;
    }
    // Collisions
    if (bird.x + bird.radius > pipes[i].x && bird.x - bird.radius < pipes[i].x + 50) {
      if (bird.y - bird.radius < pipes[i].top || bird.y + bird.radius > canvas.height - pipes[i].bottom) {
        gameOver();
      }
    }
    if (pipes[i].x < -60) pipes.splice(i, 1);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Bird
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(bird.x, bird.y, bird.radius, 0, Math.PI * 2);
  ctx.fill();

  // Pipes
  ctx.fillStyle = '#2ecc71';
  pipes.forEach(p => {
    ctx.fillRect(p.x, 0, 50, p.top);
    ctx.fillRect(p.x, canvas.height - p.bottom, 50, p.bottom);
  });
}

function gameOver() {
  isRunning = false;
  startOverlay.style.display = 'flex';
  startOverlay.querySelector('h1').textContent = 'Oyun Bitti!';
  startOverlay.querySelector('p').textContent = 'Skorunuz: ' + score;
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}
loop();`
    },
    {
      id: 'f_manifest_json',
      name: 'manifest.json',
      path: 'manifest.json',
      size: 420,
      type: 'application/json',
      isBinary: false,
      lastModified: Date.now(),
      content: `{
  "short_name": "FlappyWeb",
  "name": "Flappy Bird Web to APK",
  "icons": [
    {
      "src": "icon.png",
      "type": "image/png",
      "sizes": "192x192"
    }
  ],
  "start_url": "./index.html",
  "background_color": "#111111",
  "theme_color": "#e67e22",
  "display": "standalone",
  "orientation": "portrait"
}`
    }
  ]
};

export const StorageService = {
  getProjects(): Project[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        const initial = [SAMPLE_WEB_PROJECT];
        this.saveProjects(initial);
        return initial;
      }
      return JSON.parse(data) as Project[];
    } catch (err) {
      console.error('Failed to load projects from localStorage:', err);
      return [SAMPLE_WEB_PROJECT];
    }
  },

  saveProjects(projects: Project[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (err) {
      console.error('Failed to save projects to localStorage:', err);
    }
  },

  getProject(id: string): Project | null {
    const list = this.getProjects();
    return list.find(p => p.id === id) || null;
  },

  saveProject(project: Project): void {
    const list = this.getProjects();
    const index = list.findIndex(p => p.id === project.id);
    const updated = { ...project, updatedAt: Date.now() };
    if (index >= 0) {
      list[index] = updated;
    } else {
      list.unshift(updated);
    }
    this.saveProjects(list);
  },

  deleteProject(id: string): void {
    const list = this.getProjects().filter(p => p.id !== id);
    this.saveProjects(list);
    if (this.getActiveProjectId() === id) {
      this.setActiveProjectId(list[0]?.id || null);
    }
  },

  getActiveProjectId(): string | null {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || SAMPLE_WEB_PROJECT.id;
  },

  setActiveProjectId(id: string | null): void {
    if (id) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }
};
