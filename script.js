// =====================================================
// ============ 3D SNAKE — THREE.JS VERSION ============
// =====================================================

// ====== DOM elementlar ======
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');
const soundBtn = document.getElementById('soundBtn');
const game3dEl = document.getElementById('game3d');

// ====== Konstantalar ======
const GRID_SIZE = 20;
const TILE = 1;

// ====== O'yin holati ======
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let highScore = 0;
let gameLoop = null;
let gameSpeed = 120;
let isRunning = false;
let isPaused = false;
let particles = [];

// ====== LocalStorage ======
const STORAGE_KEY = 'snakeHighScore3D';
const SOUND_KEY = 'snakeSoundEnabled3D';

function loadHighScore() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        highScore = saved ? parseInt(saved, 10) : 0;
        if (isNaN(highScore)) highScore = 0;
    } catch (e) {
        highScore = 0;
    }
    highScoreEl.textContent = highScore;
}

function saveHighScore() {
    try {
        localStorage.setItem(STORAGE_KEY, highScore.toString());
    } catch (e) {
        console.warn('LocalStorage ishlamayapti:', e);
    }
}

// =====================================================
// ==================== AUDIO SYSTEM ===================
// =====================================================
const AudioSystem = {
    ctx: null,
    enabled: true,
    musicGain: null,
    sfxGain: null,
    musicTimer: null,
    musicStep: 0,
    musicTempo: 220,

    init() {
        if (this.ctx) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.35;
            this.sfxGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.06;
            this.musicGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn("Web Audio API qo'llab-quvvatlanmaydi:", e);
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playTone(freq, duration, type, volume, delay, targetGain) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        type = type || 'sine';
        volume = volume === undefined ? 1 : volume;
        delay = delay || 0;

        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);

        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(volume * 0.4, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

        osc.connect(gain);
        gain.connect(targetGain || this.sfxGain);

        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    },

    playSweep(f1, f2, duration, type, volume, delay) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        type = type || 'sine';
        volume = volume === undefined ? 1 : volume;
        delay = delay || 0;

        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(f1, t0);
        osc.frequency.exponentialRampToValueAtTime(f2, t0 + duration);

        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(volume * 0.4, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    },

    playEat() {
        this.playSweep(600, 1200, 0.12, 'square', 0.6);
        this.playTone(1400, 0.08, 'triangle', 0.4, 0.06);
    },

    playStart() {
        this.playTone(523, 0.12, 'triangle', 0.7, 0);
        this.playTone(659, 0.12, 'triangle', 0.7, 0.12);
        this.playTone(784, 0.18, 'triangle', 0.7, 0.24);
    },

    playGameOver() {
        this.playTone(400, 0.15, 'sawtooth', 0.5, 0);
        this.playTone(300, 0.15, 'sawtooth', 0.5, 0.15);
        this.playTone(200, 0.15, 'sawtooth', 0.5, 0.3);
        this.playSweep(200, 80, 0.6, 'sawtooth', 0.5, 0.45);
    },

    playRecord() {
        const notes = [523, 659, 784, 1047];
        const self = this;
        notes.forEach(function (n, i) {
            self.playTone(n, 0.18, 'triangle', 0.7, i * 0.13);
            self.playTone(n * 2, 0.18, 'sine', 0.3, i * 0.13);
        });
        this.playTone(523, 0.5, 'triangle', 0.5, 0.55);
        this.playTone(659, 0.5, 'triangle', 0.5, 0.55);
        this.playTone(784, 0.5, 'triangle', 0.5, 0.55);
        this.playTone(1047, 0.5, 'triangle', 0.5, 0.55);
    },

    playPause() {
        this.playTone(880, 0.08, 'square', 0.4, 0);
        this.playTone(660, 0.08, 'square', 0.4, 0.08);
    },

    musicNotes: [
        220, 0,   277, 0,   330, 0,   277, 0,
        220, 0,   277, 0,   330, 0,   392, 0,
        330, 0,   277, 0,   220, 0,   165, 0,
        196, 0,   247, 0,   294, 0,   247, 0,
    ],

    startMusic() {
        if (!this.enabled || !this.ctx) return;
        this.stopMusic();
        this.musicStep = 0;

        const self = this;
        const tick = function () {
            if (!self.enabled || !self.ctx) return;
            const freq = self.musicNotes[self.musicStep % self.musicNotes.length];
            if (freq > 0) {
                const t0 = self.ctx.currentTime;
                const osc = self.ctx.createOscillator();
                const g = self.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;

                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);

                osc.connect(g);
                g.connect(self.musicGain);
                osc.start(t0);
                osc.stop(t0 + 0.22);
            }
            self.musicStep++;
        };

        tick();
        this.musicTimer = setInterval(tick, this.musicTempo);
    },

    stopMusic() {
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    },

    setEnabled(val) {
        this.enabled = val;
        if (!val) this.stopMusic();
        try {
            localStorage.setItem(SOUND_KEY, val ? '1' : '0');
        } catch (e) {}
    },

    loadPref() {
        try {
            const saved = localStorage.getItem(SOUND_KEY);
            if (saved === '0') this.enabled = false;
        } catch (e) {}
    }
};

function updateSoundBtn() {
    if (AudioSystem.enabled) {
        soundBtn.textContent = '🔊';
        soundBtn.classList.remove('muted');
    } else {
        soundBtn.textContent = '🔇';
        soundBtn.classList.add('muted');
    }
}

soundBtn.addEventListener('click', function () {
    AudioSystem.init();
    const newState = !AudioSystem.enabled;
    AudioSystem.setEnabled(newState);
    updateSoundBtn();
    if (newState && isRunning && !isPaused) {
        AudioSystem.startMusic();
    }
});

// =====================================================
// =================== THREE.JS SETUP ==================
// =====================================================
let scene, camera, renderer;
let snakeMeshes = [];
let foodMesh = null;
let foodLight = null;
let floorMesh = null;
let particlesGroup = null;
let clock = null;
let gridHelper = null;

const SNAKE_HEAD_COLOR = 0x00ff88;
const SNAKE_BODY_COLOR = 0x00b8ff;
const FOOD_COLOR = 0xff2e63;

function initThree() {
    const wrapper = game3dEl;
    const size = wrapper.clientWidth || 400;

    // ===== Scene =====
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050f);
    scene.fog = new THREE.Fog(0x05050f, 25, 45);

    // ===== Camera =====
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 22, 20);
    camera.lookAt(0, 0, 0);

    // ===== Renderer =====
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrapper.appendChild(renderer.domElement);

    // ===== Yorug'lik =====
    const ambient = new THREE.AmbientLight(0x404060, 1.2);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(10, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -25;
    scene.add(dirLight);

    const pointLight1 = new THREE.PointLight(0x00ff88, 0.8, 40);
    pointLight1.position.set(-12, 8, -12);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x00b8ff, 0.8, 40);
    pointLight2.position.set(12, 8, 12);
    scene.add(pointLight2);

    // ===== Zamin =====
    const floorGeo = new THREE.PlaneGeometry(GRID_SIZE * TILE, GRID_SIZE * TILE);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a20,
        roughness: 0.85,
        metalness: 0.3
    });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.5;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // ===== Grid chiziqlar =====
    gridHelper = new THREE.GridHelper(
        GRID_SIZE * TILE,
        GRID_SIZE,
        0x00ff88,
        0x0f3460
    );
    gridHelper.position.y = -0.49;
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // ===== Chegara chizig'i =====
    const borderGeo = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(GRID_SIZE * TILE, 0.1, GRID_SIZE * TILE)
    );
    const borderMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.position.y = -0.45;
    scene.add(border);

    // ===== Zarrachalar guruhi =====
    particlesGroup = new THREE.Group();
    scene.add(particlesGroup);

    // ===== Clock =====
    clock = new THREE.Clock();

    // ===== Resize =====
    window.addEventListener('resize', onWindowResize);

    // ===== Render loop =====
    animate();
}

function onWindowResize() {
    if (!renderer || !camera) return;
    const size = game3dEl.clientWidth || 400;
    renderer.setSize(size, size);
}

// =====================================================
// =================== YORDAMCHI FUNKSIYALAR ===========
// =====================================================

function gridToWorld(gx, gy) {
    return {
        x: (gx - GRID_SIZE / 2 + 0.5) * TILE,
        z: (gy - GRID_SIZE / 2 + 0.5) * TILE
    };
}

function createSnakeSegment(gx, gy, isHead) {
    const geo = new THREE.BoxGeometry(
        TILE * 0.9,
        isHead ? TILE * 1.05 : TILE * 0.85,
        TILE * 0.9
    );

    const mat = new THREE.MeshStandardMaterial({
        color: isHead ? SNAKE_HEAD_COLOR : SNAKE_BODY_COLOR,
        emissive: isHead ? 0x00ff88 : 0x004466,
        emissiveIntensity: isHead ? 0.85 : 0.4,
        roughness: 0.35,
        metalness: 0.7
    });

    const mesh = new THREE.Mesh(geo, mat);
    const pos = gridToWorld(gx, gy);
    mesh.position.set(pos.x, isHead ? 0.55 : 0.42, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isHead = isHead;

    if (isHead) {
        const eyeGeo = new THREE.SphereGeometry(0.09, 12, 12);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0d1117 });

        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.25, 0.15, -0.4);
        mesh.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.25, 0.15, -0.4);
        mesh.add(eyeR);
    }

    scene.add(mesh);
    return mesh;
}

function createFood(gx, gy) {
    if (foodMesh) {
        scene.remove(foodMesh);
        foodMesh.traverse(function (child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
    if (foodLight) {
        scene.remove(foodLight);
    }

    const group = new THREE.Group();

    // Olma tanasi
    const bodyGeo = new THREE.SphereGeometry(0.38, 20, 20);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: FOOD_COLOR,
        emissive: 0xff2e63,
        emissiveIntensity: 0.6,
        roughness: 0.25,
        metalness: 0.4
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Poyasi
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8);
    const stemMat = new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x226644,
        emissiveIntensity: 0.4
    });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.42;
    stem.rotation.z = 0.15;
    stem.castShadow = true;
    group.add(stem);

    // Barg
    const leafGeo = new THREE.SphereGeometry(0.1, 8, 8);
    leafGeo.scale(1.6, 0.35, 1);
    const leafMat = new THREE.MeshStandardMaterial({
        color: 0x22cc66,
        emissive: 0x11aa44,
        emissiveIntensity: 0.5
    });
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(0.14, 0.5, 0);
    leaf.rotation.z = -0.5;
    leaf.castShadow = true;
    group.add(leaf);

    const pos = gridToWorld(gx, gy);
    group.position.set(pos.x, 0.4, pos.z);

    scene.add(group);
    foodMesh = group;

    foodLight = new THREE.PointLight(0xff2e63, 1.2, 6);
    foodLight.position.set(pos.x, 1.2, pos.z);
    scene.add(foodLight);
}

function createParticles3D(gx, gy) {
    const pos = gridToWorld(gx, gy);

    for (let i = 0; i < 18; i++) {
        const geo = new THREE.SphereGeometry(0.08, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xff2e63 : 0xff8fa3,
            transparent: true,
            opacity: 1
        });
        const p = new THREE.Mesh(geo, mat);

        p.position.set(pos.x, 0.4, pos.z);

        const angle = Math.random() * Math.PI * 2;
        const speed = 0.08 + Math.random() * 0.12;
        p.userData.vx = Math.cos(angle) * speed;
        p.userData.vy = 0.12 + Math.random() * 0.15;
        p.userData.vz = Math.sin(angle) * speed;
        p.userData.life = 1;

        particlesGroup.add(p);
        particles.push(p);
    }
}

function updateParticles3D(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.x += p.userData.vx;
        p.position.y += p.userData.vy;
        p.position.z += p.userData.vz;
        p.userData.vy -= 0.008;
        p.userData.life -= delta * 1.2;

        p.material.opacity = Math.max(0, p.userData.life);
        const s = Math.max(0.05, p.userData.life);
        p.scale.set(s, s, s);

        if (p.userData.life <= 0) {
            particlesGroup.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            particles.splice(i, 1);
        }
    }
}

function rebuildSnakeMeshes() {
    // Eski meshlarni o'chirish
    for (let i = 0; i < snakeMeshes.length; i++) {
        const m = snakeMeshes[i];
        scene.remove(m);
        m.traverse(function (child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
    snakeMeshes = [];

    // Yangi meshlar yaratish
    for (let i = 0; i < snake.length; i++) {
        const seg = snake[i];
        const isHead = i === 0;
        const mesh = createSnakeSegment(seg.x, seg.y, isHead);

        if (!isHead) {
            const t = i / Math.max(snake.length, 1);
            const color = new THREE.Color();
            color.setHSL(0.5 - t * 0.15, 0.9, 0.5 - t * 0.15);
            mesh.material.color = color;
            mesh.material.emissive = new THREE.Color(0x003344);
        }

        snakeMeshes.push(mesh);
    }
}

// =====================================================
// ==================== O'YIN MANTIG'I =================
// =====================================================

function initGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    gameSpeed = 120;
    scoreEl.textContent = score;

    // Zarrachalarni tozalash
    if (particlesGroup) {
        while (particlesGroup.children.length > 0) {
            const p = particlesGroup.children[0];
            particlesGroup.remove(p);
            if (p.geometry) p.geometry.dispose();
            if (p.material) p.material.dispose();
        }
    }
    particles = [];

    spawnFood();
    rebuildSnakeMeshes();
}

function spawnFood() {
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 1000) {
        food = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        let overlap = false;
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === food.x && snake[i].y === food.y) {
                overlap = true;
                break;
            }
        }
        valid = !overlap;
        attempts++;
    }
    if (scene) createFood(food.x, food.y);
}

// ====== Silliq o'tish animatsiyasi ======
let animProgress = 0;
let animStart = 0;
let animDuration = 120;

function applySmoothPositions(t) {
    // t — 0..1 oralig'i (silliq o'tish)
    for (let i = 0; i < snakeMeshes.length && i < snake.length; i++) {
        const mesh = snakeMeshes[i];
        const target = snake[i];
        const targetPos = gridToWorld(target.x, target.y);

        // Oldingi pozitsiya (mesh joylashgan)
        const oldX = mesh.userData.oldX !== undefined ? mesh.userData.oldX : targetPos.x;
        const oldZ = mesh.userData.oldZ !== undefined ? mesh.userData.oldZ : targetPos.z;

        mesh.position.x = oldX + (targetPos.x - oldX) * t;
        mesh.position.z = oldZ + (targetPos.z - oldZ) * t;
    }
}

function storeOldPositions() {
    for (let i = 0; i < snakeMeshes.length && i < snake.length; i++) {
        const mesh = snakeMeshes[i];
        mesh.userData.oldX = mesh.position.x;
        mesh.userData.oldZ = mesh.position.z;
    }
}

// ====== O'yin yangilanishi ======
function update() {
    direction = { x: nextDirection.x, y: nextDirection.y };

    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    // Devorga urilish
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        return gameOver();
    }

    // O'ziga urilish
    for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            return gameOver();
        }
    }

    snake.unshift(head);

    // Ovqat yeyish
    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;
        createParticles3D(food.x, food.y);
        spawnFood();

        AudioSystem.playEat();

        if (score % 5 === 0 && gameSpeed > 50) {
            gameSpeed -= 8;
            restartLoop();
        }
    } else {
        snake.pop();
    }

    // Meshlarni yangilash
    storeOldPositions();
    rebuildSnakeMeshes();

    // Animatsiyani boshlash
    animStart = performance.now();
    animDuration = Math.max(gameSpeed - 20, 40);
}

function restartLoop() {
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(function () {
        if (!isPaused && isRunning) {
            update();
        }
    }, gameSpeed);
}

// ====== O'yin tugashi ======
function gameOver() {
    isRunning = false;
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }

    AudioSystem.stopMusic();
    AudioSystem.playGameOver();

    if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        saveHighScore();
        overlayTitle.textContent = '🏆 Yangi Rekord!';
        overlayText.textContent = "Tabriklaymiz! Siz " + score + " ball to'pladingiz va rekordni yangiladingiz!";

        setTimeout(function () {
            AudioSystem.playRecord();
        }, 900);
    } else {
        overlayTitle.textContent = "💀 O'yin Tugadi";
        overlayText.textContent = "Sizning natijangiz: " + score + " ball. Rekord: " + highScore + " ball.";
    }

    startBtn.textContent = 'Qayta Boshlash';
    overlay.classList.remove('hidden');
}

// =====================================================
// ==================== ANIMATE LOOP ===================
// =====================================================
function animate() {
    requestAnimationFrame(animate);

    const delta = clock ? clock.getDelta() : 0.016;

    // Silliq pozitsiyalash
    if (snakeMeshes.length > 0) {
        const now = performance.now();
        let t = (now - animStart) / animDuration;
        if (t > 1) t = 1;
        if (t < 0) t = 0;
        // Ease-in-out
        t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        applySmoothPositions(t);
    }

    // Bosh ko'zlarini yo'nalishga qarab aylantirish
    if (snakeMeshes.length > 0 && snakeMeshes[0]) {
        const head = snakeMeshes[0];
        let rotY = 0;
        if (direction.x === 1) rotY = 0;
        else if (direction.x === -1) rotY = Math.PI;
        else if (direction.y === 1) rotY = Math.PI / 2;
        else if (direction.y === -1) rotY = -Math.PI / 2;
        head.rotation.y = rotY;
    }

    // Ovqat animatsiyasi (aylanish + pulsatsiya)
    if (foodMesh) {
        foodMesh.rotation.y += delta * 1.5;
        const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08;
        foodMesh.scale.set(pulse, pulse, pulse);
        foodMesh.position.y = 0.4 + Math.sin(performance.now() * 0.003) * 0.08;
    }

    // Zarrachalarni yangilash
    if (particlesGroup) {
        updateParticles3D(delta);
    }

    // Kamera sekin aylanishi (atmosfera uchun)
    const time = performance.now() * 0.0002;
    camera.position.x = Math.sin(time) * 2;
    camera.position.z = 20 + Math.cos(time) * 1;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
}

// =====================================================
// ==================== BOSHQARISH =====================
// =====================================================
function setDirection(x, y) {
    if (direction.x === -x && direction.y === -y) return;
    nextDirection = { x: x, y: y };
}

document.addEventListener('keydown', function (e) {
    const key = e.key.toLowerCase();

    if (key === 'm') {
        AudioSystem.init();
        const newState = !AudioSystem.enabled;
        AudioSystem.setEnabled(newState);
        updateSoundBtn();
        if (newState && isRunning && !isPaused) {
            AudioSystem.startMusic();
        }
        return;
    }

    if (key === ' ') {
        e.preventDefault();
        if (isRunning) {
            isPaused = !isPaused;
            AudioSystem.playPause();
            if (isPaused) {
                AudioSystem.stopMusic();
            } else {
                AudioSystem.startMusic();
            }
        }
        return;
    }

    if (key === 'r') {
        if (!isRunning) {
            startGame();
        }
        return;
    }

    if (!isRunning || isPaused) return;

    switch (key) {
        case 'arrowup':
        case 'w':
            e.preventDefault();
            setDirection(0, -1);
            break;
        case 'arrowdown':
        case 's':
            e.preventDefault();
            setDirection(0, 1);
            break;
        case 'arrowleft':
        case 'a':
            e.preventDefault();
            setDirection(-1, 0);
            break;
        case 'arrowright':
        case 'd':
            e.preventDefault();
            setDirection(1, 0);
            break;
    }
});

// Mobil tugmalar
const arrowBtns = document.querySelectorAll('.arrow-btn');
arrowBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (!isRunning || isPaused) return;
        const dir = btn.dataset.dir;
        switch (dir) {
            case 'up': setDirection(0, -1); break;
            case 'down': setDirection(0, 1); break;
            case 'left': setDirection(-1, 0); break;
            case 'right': setDirection(1, 0); break;
        }
    });
});

// Swipe (mobil)
let touchStartX = 0, touchStartY = 0;
game3dEl.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

game3dEl.addEventListener('touchend', function (e) {
    if (!isRunning || isPaused) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 30) return;

    if (absDx > absDy) {
        setDirection(dx > 0 ? 1 : -1, 0);
    } else {
        setDirection(0, dy > 0 ? 1 : -1);
    }
}, { passive: true });

// =====================================================
// ==================== START / RESTART ===============
// =====================================================
function startGame() {
    AudioSystem.init();
    AudioSystem.resume();

    initGame();
    overlay.classList.add('hidden');
    isRunning = true;
    isPaused = false;
    startBtn.textContent = 'Boshlash';

    AudioSystem.playStart();

    if (AudioSystem.enabled) {
        setTimeout(function () {
            AudioSystem.startMusic();
        }, 500);
    }

    restartLoop();
}

startBtn.addEventListener('click', function () {
    startGame();
});

// =====================================================
// ==================== INIT ===========================
// =====================================================
AudioSystem.loadPref();
updateSoundBtn();
loadHighScore();

// Three.js ni ishga tushirish
initThree();
initGame();

// AudioContext'ni birinchi harakatda ishga tushirish
function initAudioOnce() {
    AudioSystem.init();
    AudioSystem.resume();
    document.removeEventListener('click', initAudioOnce);
    document.removeEventListener('keydown', initAudioOnce);
    document.removeEventListener('touchstart', initAudioOnce);
}

document.addEventListener('click', initAudioOnce);
document.addEventListener('keydown', initAudioOnce);
document.addEventListener('touchstart', initAudioOnce);