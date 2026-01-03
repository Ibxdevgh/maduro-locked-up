import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ CONFIG ============
const MADURO_MODEL = 'maduro_main.glb';
// ================================

// Global state
let scene, camera, renderer, controls;
let avatar, mixer;
let clock = new THREE.Clock();

// Prison cell lights for dramatic effect
let redLight, blueLight;
let lightTime = 0;

// Initialize the scene
function init() {
    const canvas = document.getElementById('avatar-canvas');

    // Scene - prison atmosphere
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1515);
    scene.fog = new THREE.Fog(0x1a1515, 8, 20);
    
    // Camera - full screen
    camera = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.2, 4.5);

    // Renderer - full screen
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // === PRISON LIGHTING ===
    
    // Brighter ambient for visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Main overhead harsh light (like a prison spotlight)
    const mainLight = new THREE.SpotLight(0xffffff, 3, 15, Math.PI / 4, 0.3);
    mainLight.position.set(0, 5, 3);
    mainLight.target.position.set(0, 1, 0);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);
    scene.add(mainLight.target);

    // Front fill light - makes the character clearly visible
    const frontLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    frontLight.position.set(0, 2, 5);
    scene.add(frontLight);

    // Red police light (rotating)
    redLight = new THREE.PointLight(0xff2020, 0.3, 10);
    redLight.position.set(-3, 2, 2);
    scene.add(redLight);

    // Blue police light (rotating opposite)
    blueLight = new THREE.PointLight(0x2040ff, 0.3, 10);
    blueLight.position.set(3, 2, 2);
    scene.add(blueLight);

    // Orange/rust accent from below
    const accentLight = new THREE.PointLight(0xff6b35, 0.8, 8);
    accentLight.position.set(0, 0.5, 3);
    scene.add(accentLight);

    // Back rim light for depth
    const rimLight = new THREE.PointLight(0xffffee, 1.0, 10);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    // === PRISON FLOOR ===
    
    // Concrete floor
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2520,
        roughness: 0.9,
        metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Prison cell bars (simple visual - actual bars are CSS overlay)
    // Add a subtle grid pattern on floor
    const gridHelper = new THREE.GridHelper(10, 20, 0x1a1510, 0x151210);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minAzimuthAngle = -Math.PI / 6;
    controls.maxAzimuthAngle = Math.PI / 6;
    controls.target.set(0, 1, 0);
    controls.update();

    // Load Maduro avatar
    loadAvatar(MADURO_MODEL);

    // Handle resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
}

// Load the GLB avatar
function loadAvatar(filename, onComplete) {
    const loader = new GLTFLoader();
    
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">DETAINING...</div>
    `;
    document.body.appendChild(loadingDiv);

    // Remove existing avatar
    if (avatar) {
        scene.remove(avatar);
        avatar = null;
        mixer = null;
    }

    loader.load(
        filename,
        (gltf) => {
            avatar = gltf.scene;
            avatar.scale.set(1, 1, 1);
            avatar.position.set(0, 0, 0);
            
            avatar.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(avatar);

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(avatar);
                const idleAction = mixer.clipAction(gltf.animations[0]);
                idleAction.play();
            } else {
                addIdleAnimation();
            }

            loadingDiv.remove();
            if (onComplete) onComplete();
        },
        (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
            loadingDiv.querySelector('.loading-text').textContent = 
                `DETAINING... ${Math.round(percent)}%`;
        },
        (error) => {
            console.error('Error loading avatar:', error);
            loadingDiv.querySelector('.loading-text').textContent = 'ESCAPED! (load failed)';
            setTimeout(() => loadingDiv.remove(), 2000);
        }
    );
}

function addIdleAnimation() {
    if (!avatar) return;
    // Subtle nervous shaking animation for a prisoner
    window.idleAnimation = () => {
        const time = clock.getElapsedTime();
        // Subtle nervous movement
        avatar.position.y = Math.sin(time * 2) * 0.005;
        avatar.rotation.y = Math.sin(time * 0.8) * 0.02;
        // Occasional twitch
        if (Math.sin(time * 5) > 0.98) {
            avatar.position.x = (Math.random() - 0.5) * 0.01;
        }
    };
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    lightTime += delta;
    
    // Animate police lights (subtle pulsing)
    const pulse = Math.sin(lightTime * 2) * 0.5 + 0.5;
    redLight.intensity = pulse * 0.8;
    blueLight.intensity = (1 - pulse) * 0.8;
    
    // Move lights slightly
    redLight.position.x = -3 + Math.sin(lightTime) * 0.5;
    blueLight.position.x = 3 - Math.sin(lightTime) * 0.5;
    
    if (mixer) mixer.update(delta);
    if (window.idleAnimation) window.idleAnimation();
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============ CHAT ============
const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);

// Maduro responses (client-side fallback)
const MADURO_RESPONSES = [
    "*crying* why you do this to me... I was just trying to help my people...",
    "the empire... the gringos... they set me up, I swear!",
    "*sobbing* my beautiful Venezuela... my arepas... my power...",
    "this is a coup! a CIA operation! I demand to speak to Putin!",
    "I miss my bus... I was a good bus driver, you know?",
    "*nervously* you think they'll let me keep my mustache in here?",
    "Chavez told me in a dream... he said 'Nicolás, you messed up big time'",
    "I blame the iguanas... they ate all our prosperity",
    "*sweating* how many years did you say? LIFE PLUS WHAT?!",
    "at least the food here is better than what my people had...",
    "I should have stayed driving buses... much simpler life",
    "*whimpering* can I at least get some dulce de leche?",
    "the bird... Chavez came to me as a bird... why didn't he warn me?!",
    "you know I used to dance salsa? now I dance to survive in here",
    "*defeated* okay okay I admit... maybe I made some mistakes..."
];

function setupChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const speechBubble = document.getElementById('speech-bubble');
    const tolyMessage = document.getElementById('toly-message');
    let isLoading = false;

    const sendMessage = async () => {
        const message = input.value.trim();
        if (!message || isLoading) return;

        isLoading = true;
        sendBtn.disabled = true;
        sendBtn.textContent = '...';
        input.value = '';

        // Show thinking state
        tolyMessage.textContent = '*nervously sweating*';
        speechBubble.classList.add('thinking');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId })
            });
            
            const data = await response.json();
            const reply = data.error ? MADURO_RESPONSES[Math.floor(Math.random() * MADURO_RESPONSES.length)] : data.response;
            
            tolyMessage.textContent = reply;
            speechBubble.classList.remove('thinking');

        } catch (error) {
            // Use local responses as fallback
            tolyMessage.textContent = MADURO_RESPONSES[Math.floor(Math.random() * MADURO_RESPONSES.length)];
            speechBubble.classList.remove('thinking');
        }

        isLoading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'ASK';
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// ============ AUDIO ============
function setupAudio() {
    const audioBtn = document.getElementById('audio-toggle');
    const music = document.getElementById('bg-music');
    let audioEnabled = true;
    
    music.volume = 0.2;
    
    const startMusic = () => {
        if (audioEnabled) {
            music.play().catch(() => {});
        }
        document.removeEventListener('click', startMusic);
        document.removeEventListener('keypress', startMusic);
    };
    
    music.play().catch(() => {
        document.addEventListener('click', startMusic);
        document.addEventListener('keypress', startMusic);
    });
    
    audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audioEnabled = !audioEnabled;
        audioBtn.querySelector('span').textContent = audioEnabled ? '🔊' : '🔇';
        if (audioEnabled) {
            music.play();
        } else {
            music.pause();
        }
    });
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupChat();
    setupAudio();
});
