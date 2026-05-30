import './style.css';
import { Engine } from './game/Engine.js';
import { Ball, PITCH_TYPES } from './game/Ball.js';
import { Pitcher } from './game/Pitcher.js';
import { Batter } from './game/Batter.js';
import { ParticleSystem } from './game/ParticleSystem.js';
import { AudioManager } from './game/AudioManager.js';

class GameManager {
  constructor() {
    this.state = 'TITLE'; // TITLE, PLAYING, GAMEOVER
    
    // Core game components
    this.audio = new AudioManager();
    this.engine = new Engine('game-canvas', this);
    this.ball = new Ball(this.engine);
    this.pitcher = new Pitcher(this.engine, this.ball);
    this.batter = new Batter(this.engine, this.ball);
    this.particles = new ParticleSystem(this.engine);
    
    // Gameplay variables
    this.score = 0;
    this.totalDistance = 0;
    this.homeruns = 0;
    this.combo = 0;
    this.maxCombo = 0;
    
    this.ballsRemaining = 10;
    this.ballsThrown = 0;
    this.timeLeft = 60;
    
    // Timer IDs
    this.gameTimerId = null;
    this.pitchSequenceTimeoutId = null;
    
    // Play state status
    this.isPlaying = false;
    this.isWaitingForNextPitch = false;
    this.isBallActive = false;
    
    // Load local highscore
    this.highScore = parseInt(localStorage.getItem('cyber_batting_highscore')) || 0;
    
    // Element Caches
    this.cacheDOMElements();
    this.bindEvents();
    this.updateHighScoreDisplay();
  }

  cacheDOMElements() {
    // Screens
    this.titleScreen = document.getElementById('title-screen');
    this.gameScreen = document.getElementById('game-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    
    // Buttons
    this.startBtn = document.getElementById('start-btn');
    this.retryBtn = document.getElementById('retry-btn');
    this.exitBtn = document.getElementById('exit-btn');
    this.swingBtn = document.getElementById('swing-btn');
    
    // HUD Indicators
    this.scoreVal = document.getElementById('score-val');
    this.timerVal = document.getElementById('timer-val');
    this.ballsVal = document.getElementById('balls-val');
    this.comboDisplay = document.getElementById('combo-display');
    this.comboCount = document.getElementById('combo-count');
    this.hitInfo = document.getElementById('hit-info');
    this.hitJudge = document.getElementById('hit-judge');
    this.hitDistance = document.getElementById('hit-distance');
    
    // Results Indicators
    this.finalScore = document.getElementById('final-score');
    this.finalDistance = document.getElementById('final-distance');
    this.finalCombo = document.getElementById('final-combo');
    this.finalHomeruns = document.getElementById('final-homeruns');
    this.newRecordBanner = document.getElementById('new-record-banner');
    this.globalHighScore = document.getElementById('global-high-score');
    
    // Controls elements
    this.aimPad = document.getElementById('aim-pad');
    this.aimJoystick = document.getElementById('aim-joystick');
  }

  bindEvents() {
    // Start sequence
    this.startBtn.addEventListener('click', () => {
      this.audio.unlock(); // Critical: unlock iOS audio on click
      this.changeState('PLAYING');
    });
    
    // Retry sequence
    this.retryBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.changeState('PLAYING');
    });
    
    // Exit sequence
    this.exitBtn.addEventListener('click', () => {
      this.changeState('TITLE');
    });
    
    // Swing controls
    this.swingBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent double triggering / zooming
      this.handleSwingInput();
    });
    // Mouse fallback for desktop testing
    this.swingBtn.addEventListener('mousedown', (e) => {
      this.handleSwingInput();
    });
    
    // Aimpad Drag Controls
    this.setupJoystickEvents();
  }

  setupJoystickEvents() {
    let isDragging = false;
    let padRect = null;
    
    const handleStart = (clientX, clientY) => {
      isDragging = true;
      padRect = this.aimPad.getBoundingClientRect();
      handleMove(clientX, clientY);
    };
    
    const handleMove = (clientX, clientY) => {
      if (!isDragging || !padRect) return;
      
      // Calculate delta relative to pad center
      const centerX = padRect.left + padRect.width / 2;
      const centerY = padRect.top + padRect.height / 2;
      
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      
      const radius = padRect.width / 2;
      
      // Convert to normalized coordinates (-1.0 to 1.0)
      let inputX = dx / radius;
      let inputY = dy / radius;
      
      // Clamp to unit circle
      const dist = Math.sqrt(inputX * inputX + inputY * inputY);
      if (dist > 1.0) {
        inputX /= dist;
        inputY /= dist;
      }
      
      // Update Joystick visual handle
      // Limit visually inside the pad
      const limitPx = radius - 16; // pad radius minus handle radius
      const handleX = inputX * limitPx;
      const handleY = inputY * limitPx;
      
      this.aimJoystick.style.left = `${radius + handleX}px`;
      this.aimJoystick.style.top = `${radius + handleY}px`;
      
      // Pass normalized input to batter aiming cursor
      this.batter.setAim(inputX, inputY);
    };
    
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      
      // Snap joystick handle back to center
      const radius = padRect ? padRect.width / 2 : 50;
      this.aimJoystick.style.left = '50%';
      this.aimJoystick.style.top = '50%';
      
      // Optionally reset aiming to center
      this.batter.setAim(0, 0);
    };
    
    // Touch listeners
    this.aimPad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    }, { passive: false });
    
    this.aimPad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }, { passive: false });
    
    this.aimPad.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleEnd();
    }, { passive: false });
    
    // Mouse listeners for debugging on desktop
    this.aimPad.addEventListener('mousedown', (e) => {
      handleStart(e.clientX, e.clientY);
    });
    
    window.addEventListener('mousemove', (e) => {
      handleMove(e.clientX, e.clientY);
    });
    
    window.addEventListener('mouseup', () => {
      handleEnd();
    });
  }

  handleSwingInput() {
    if (this.state !== 'PLAYING') return;
    
    // Prevent swing if already swinging
    if (this.batter.isSwinging) return;
    
    this.batter.swing();
    this.audio.playSwingSE();
  }

  changeState(newState) {
    this.state = newState;
    
    // Toggle CSS classes on screens
    this.titleScreen.classList.remove('active');
    this.gameScreen.classList.remove('active');
    this.gameoverScreen.classList.remove('active');
    
    if (this.state === 'TITLE') {
      this.titleScreen.classList.add('active');
      this.engine.stop();
      this.audio.stopBGM();
      this.isPlaying = false;
    } else if (this.state === 'PLAYING') {
      this.gameScreen.classList.add('active');
      this.startGame();
    } else if (this.state === 'GAMEOVER') {
      this.gameoverScreen.classList.add('active');
      this.endGame();
    }
  }

  updateHighScoreDisplay() {
    this.globalHighScore.textContent = `${this.highScore.toLocaleString()} m`;
  }

  startGame() {
    // Reset gameplay variables
    this.score = 0;
    this.totalDistance = 0;
    this.homeruns = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.ballsRemaining = 10;
    this.ballsThrown = 0;
    this.timeLeft = 60;
    
    this.isPlaying = true;
    this.isWaitingForNextPitch = false;
    this.isBallActive = false;
    
    // Clear display HUD
    this.scoreVal.textContent = '0';
    this.timerVal.textContent = '60s';
    this.ballsVal.textContent = '0/10';
    
    this.comboDisplay.classList.add('hidden');
    this.hitInfo.classList.add('hidden');
    
    // Reset Game Engine
    this.engine.start();
    this.ball.reset();
    this.pitcher.reset();
    this.batter.reset();
    this.particles.reset();
    
    // Start Audio
    this.audio.startBGM();
    
    // Start timer sequence (counting down seconds)
    if (this.gameTimerId) clearInterval(this.gameTimerId);
    this.gameTimerId = setInterval(() => {
      this.tickGameTimer();
    }, 1000);
    
    // Trigger first pitch scheduling
    this.scheduleNextPitch(1500);
  }

  tickGameTimer() {
    if (!this.isPlaying) return;
    
    this.timeLeft--;
    this.timerVal.textContent = `${this.timeLeft}s`;
    
    // Dynamic styling when low on time
    if (this.timeLeft <= 10) {
      this.timerVal.classList.add('blink');
    } else {
      this.timerVal.classList.remove('blink');
    }
    
    if (this.timeLeft <= 0) {
      this.changeState('GAMEOVER');
    }
  }

  scheduleNextPitch(delayMs) {
    if (!this.isPlaying) return;
    
    this.isWaitingForNextPitch = true;
    
    if (this.pitchSequenceTimeoutId) clearTimeout(this.pitchSequenceTimeoutId);
    
    this.pitchSequenceTimeoutId = setTimeout(() => {
      this.triggerPitch();
    }, delayMs);
  }

  triggerPitch() {
    if (!this.isPlaying) return;
    
    this.isWaitingForNextPitch = false;
    this.isBallActive = true;
    
    // Reset bat judgment status
    this.batter.hasJudged = false;
    this.ball.reset();
    
    // Select random pitch parameters
    const pitchTypeKeys = Object.keys(PITCH_TYPES);
    // 50% Fastball, 20% Curve, 20% Fork, 10% Stealth
    const rand = Math.random();
    let type = PITCH_TYPES.FASTBALL;
    
    if (rand > 0.90) {
      type = PITCH_TYPES.STEALTH;
    } else if (rand > 0.70) {
      type = PITCH_TYPES.FORKBALL;
    } else if (rand > 0.50) {
      type = PITCH_TYPES.CURVEBALL;
    }
    
    // Generate speed corresponding to pitch type (km/h)
    let speed = 145 + Math.random() * 15; // Fastball default (145 - 160)
    if (type === PITCH_TYPES.CURVEBALL) {
      speed = 120 + Math.random() * 15;
    } else if (type === PITCH_TYPES.FORKBALL) {
      speed = 130 + Math.random() * 15;
    }
    
    // Target location inside or slightly outside strike zone
    // Coordinates range from X: [-40, 40] (edges) and Y: [40, 100] (edges)
    const targetX = (Math.random() - 0.5) * 60; // Slightly wider than strike zone
    const targetY = 45 + Math.random() * 50;
    
    // Order pitcher to pitch
    this.pitcher.startPitch(type, speed, targetX, targetY);
    this.audio.playPitchSE();
    
    this.ballsThrown++;
    this.ballsRemaining = Math.max(0, 10 - this.ballsThrown);
    this.ballsVal.textContent = `${this.ballsThrown}/10`;
  }

  /**
   * Main simulation step delegated from Engine loop
   */
  update(dt) {
    if (!this.isPlaying) return;
    
    this.pitcher.update(dt);
    this.ball.update(dt);
    this.batter.update(dt);
    this.particles.update(dt);
    
    // Ambient floating dust particles
    if (Math.random() < 0.15) {
      this.particles.spawnAmbientDust(1);
    }
    
    // Core game rules monitoring:
    if (this.isBallActive) {
      // 1. Monitor bat contact trigger
      if (this.batter.isSwinging && this.batter.hasJudged && this.ball.isBatted) {
        // Triggered contact collision in Batter.js
        this.handleSuccessfulHit();
      }
      
      // 2. Monitor swing miss or ball pass (strike zone exit)
      if (this.ball.isDead) {
        this.isBallActive = false;
        this.handlePitchEnded();
      }
    }
  }

  handleSuccessfulHit() {
    this.isBallActive = false; // Ball is under batted flight status now, not pitch zone
    
    const hit = this.batter.lastHitResult;
    if (!hit) return;
    
    // Generate sparks on contact point
    // Contact point estimated from current ball location
    this.particles.spawnHitSparks(this.ball.x, this.ball.y, this.ball.z, hit.type);
    
    // Audio trigger
    this.audio.playHitSE(hit.type);
  }

  handlePitchEnded() {
    // Process results of the ball that just completed its sequence
    const hitResult = this.batter.lastHitResult;
    
    if (this.ball.isBatted) {
      // Ball landed/fled, calculate final flight distance
      const distance = this.ball.calculateDistance();
      
      // Scoring rules: 
      // Home run definition (Distance > 130m)
      const isHomeRun = distance >= 130;
      
      // Quality modifiers
      let judgeLabel = 'HIT';
      let judgeClass = 'judge-good';
      
      if (isHomeRun) {
        judgeLabel = 'HOME RUN!';
        judgeClass = 'judge-perfect';
        this.homeruns++;
        
        // Spawn massive digital fireworks in the background
        this.particles.spawnHomeRunFireworks(4);
        this.audio.playHomeRunSE();
      } else if (hitResult && hitResult.type === 'GREAT') {
        judgeLabel = 'GREAT HIT';
        judgeClass = 'judge-great';
      }
      
      // Update score:
      // Base score is distance, multiplied by combo level
      this.combo++;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }
      
      const scoreGain = Math.round(distance * (1 + (this.combo - 1) * 0.15));
      this.score += scoreGain;
      this.totalDistance += distance;
      
      // Update DOM Indicators
      this.scoreVal.textContent = this.score.toLocaleString();
      
      this.showHitHUD(judgeLabel, judgeClass, `${distance}m`);
      this.showComboHUD();
      
      // Create floating score floating particles on canvas
      this.createFloatingText(`+${scoreGain}`, this.ball.x, this.ball.y + 10, this.ball.z);
    } else {
      // Strike, Miss or out-of-play
      this.combo = 0; // Break combo sequence
      this.hideComboHUD();
      
      const msg = hitResult ? hitResult.message : 'STRIKE';
      this.showHitHUD(msg, 'judge-miss', '');
    }
    
    // Clean up active indicators
    this.batter.lastHitResult = null;
    
    // Check if game is completed
    if (this.ballsThrown >= 10) {
      // Finished all 10 balls
      setTimeout(() => {
        this.changeState('GAMEOVER');
      }, 1500);
    } else {
      // Proceed to scheduling next pitch
      this.scheduleNextPitch(1800);
    }
  }

  showHitHUD(judgeText, judgeClass, distanceText) {
    this.hitInfo.classList.remove('hidden');
    this.hitJudge.textContent = judgeText;
    
    // Clear previous judge styling classes
    this.hitJudge.className = '';
    this.hitJudge.classList.add(judgeClass);
    
    this.hitDistance.textContent = distanceText;
  }

  showComboHUD() {
    if (this.combo < 2) {
      this.hideComboHUD();
      return;
    }
    this.comboDisplay.classList.remove('hidden');
    this.comboCount.textContent = this.combo;
  }

  hideComboHUD() {
    this.comboDisplay.classList.add('hidden');
  }

  /**
   * Helper to spawn a text bubble floating upwards above canvas coordinates
   */
  createFloatingText(text, x3d, y3d, z3d) {
    const proj = this.engine.project(x3d, y3d, z3d);
    
    const wrapper = this.engine.canvas.parentElement;
    const floating = document.createElement('div');
    floating.className = 'floating-text';
    floating.textContent = text;
    floating.style.left = `${proj.x}px`;
    floating.style.top = `${proj.y}px`;
    
    // Custom neon glow based on gain score
    floating.style.color = '#fffb00';
    floating.style.textShadow = '0 0 5px #fff, 0 0 10px #fffb00';
    
    wrapper.appendChild(floating);
    
    // Remove element after animation completes
    setTimeout(() => {
      floating.remove();
    }, 1200);
  }

  endGame() {
    this.isPlaying = false;
    
    // Stop timers
    if (this.gameTimerId) clearInterval(this.gameTimerId);
    if (this.pitchSequenceTimeoutId) clearTimeout(this.pitchSequenceTimeoutId);
    
    this.engine.stop();
    this.audio.stopBGM();
    
    // Calculate new highscores
    let isNewRecord = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cyber_batting_highscore', this.highScore);
      isNewRecord = true;
      this.updateHighScoreDisplay();
    }
    
    // Display stats on result screen
    this.finalScore.textContent = this.score.toLocaleString();
    this.finalDistance.textContent = `${this.totalDistance.toLocaleString()} m`;
    this.finalCombo.textContent = this.maxCombo;
    this.finalHomeruns.textContent = this.homeruns;
    
    if (isNewRecord) {
      this.newRecordBanner.classList.remove('hidden');
    } else {
      this.newRecordBanner.classList.add('hidden');
    }
  }

  /**
   * Delegated main draw method from Engine loop
   */
  draw(ctx) {
    // 1. Pitcher at Z=0
    this.pitcher.draw(ctx);
    
    // 2. Ball at depth Z
    this.ball.draw(ctx);
    
    // 3. Batter reticle and animations at Z=100
    this.batter.draw(ctx);
    
    // 4. Hit sparks/spores
    this.particles.draw(ctx);
  }
}

// Instantiate game on load
window.addEventListener('DOMContentLoaded', () => {
  new GameManager();
});
