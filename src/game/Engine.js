/**
 * CYBER BATTING DERBY - GAME ENGINE
 * Manages the main canvas loop, screen shake, resizing, perspective projection, 
 * and coordinate drawing for the 2.5D cyberpunk stadium.
 */

export class Engine {
  constructor(canvasId, gameManager) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.game = gameManager; // Reference to main GameManager
    
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;
    
    // Camera shake effect
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    
    // Time control for Hit Stop (impact freeze)
    this.timeScale = 1.0;
    this.hitStopDuration = 0;
    
    this.isActive = false;
    this.animationFrameId = null;
    
    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // Get sizing based on client bounds
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    // Adapt to device pixel ratio for sharp rendering on iOS devices
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    
    // Re-verify styling size
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.isActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 3D Coordinates Project onto 2D Canvas Screen
   * Coordinates:
   *   x: Left/Right (Center is 0. Strikezone width is about -40 to 40)
   *   y: Up/Down (Ground is 0. Strikezone height is about 30 to 120)
   *   z: Depth (0 is Pitcher plate, 100 is Home plate / Batter box)
   */
  project(x, y, z) {
    // Vanishing point (Pitcher release zone is around here)
    const vanishX = this.width / 2;
    const vanishY = this.height * 0.32; // In upper third of screen
    
    // Non-linear projection scale to emphasize close-up action
    // Z is 0 to 100.
    const pct = z / 100;
    const scale = 0.08 + pct * 0.92; // Ball becomes much bigger as it approaches
    
    // Target base projection position
    const projX = vanishX + x * scale;
    
    // Y moves down as Z increases (pitcher is high, catcher is low on screen)
    // Vertical travel path
    const verticalTravel = this.height * 0.46; // Total vertical distance on screen
    const baseGroundY = vanishY + verticalTravel * (pct * pct); // Acceleration curve downwards
    
    // Height above ground (projected according to depth scale)
    const projY = baseGroundY - y * scale;
    
    return {
      x: projX + this.shakeX,
      y: projY + this.shakeY,
      scale: scale
    };
  }

  // Set Screen Shake trigger
  shake(duration = 15, intensity = 8) {
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  // Trigger brief slow-motion or pause on impact
  triggerHitStop(frames = 8) {
    this.hitStopDuration = frames;
  }

  loop(currentTime) {
    if (!this.isActive) return;
    
    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
    
    let dt = (currentTime - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Limit spike frames
    this.lastTime = currentTime;
    
    // Handle Hit-Stop frame skipping/slowing
    if (this.hitStopDuration > 0) {
      this.hitStopDuration--;
      this.timeScale = 0.05; // 95% slow down
    } else {
      this.timeScale = 1.0;
    }
    
    // Apply timeScale to delta time
    const adjustedDt = dt * this.timeScale;
    
    this.update(adjustedDt);
    this.draw();
  }

  update(dt) {
    // Process Screen Shake
    if (this.shakeDuration > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeDuration--;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    
    // Delegate state updates
    if (this.game && this.game.isPlaying) {
      this.game.update(dt);
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // 1. Draw Cyberpunk background and stadium lines
    this.drawBackground();
    
    // 2. Draw active gameplay elements
    if (this.game && this.game.isPlaying) {
      this.game.draw(this.ctx);
    }
  }

  drawBackground() {
    const ctx = this.ctx;
    
    // Base dark navy grid glow background
    const bgGrad = ctx.createRadialGradient(
      this.width / 2, this.height * 0.35, 20,
      this.width / 2, this.height / 2, this.height * 0.6
    );
    bgGrad.addColorStop(0, '#0c0d1b');
    bgGrad.addColorStop(0.5, '#05060b');
    bgGrad.addColorStop(1, '#020305');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw Neon Horizon line
    const vanishY = this.height * 0.32;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, vanishY);
    ctx.lineTo(this.width, vanishY);
    ctx.stroke();

    // Draw neon stadium lights in background (simplified holo-mesh)
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(this.width / 2, vanishY - 50, 100 + i * 25, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
    
    // Draw 3D floor grids
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1;
    
    // Perspective Grid Lines (rays outward from vanishing point)
    const rays = 12;
    for (let i = 0; i <= rays; i++) {
      const anglePct = i / rays;
      // Map 0..1 to an width extension at the bottom
      const startX = this.width / 2 + (anglePct - 0.5) * 80; // Small origin width
      const endX = this.width / 2 + (anglePct - 0.5) * this.width * 2.8; // Wide exit width
      
      ctx.beginPath();
      ctx.moveTo(startX, vanishY);
      ctx.lineTo(endX, this.height);
      ctx.stroke();
    }
    
    // Horizontal depth lines (closer = spaced further apart)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    const depthLines = 8;
    for (let i = 0; i <= depthLines; i++) {
      const z = (i / depthLines) * 100;
      // Exponential spacing to represent depth perspective
      const pct = z / 100;
      const proj = this.project(0, 0, z);
      
      ctx.lineWidth = 0.5 + pct * 1.5;
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.03 + pct * 0.08})`;
      
      ctx.beginPath();
      ctx.moveTo(0, proj.y);
      ctx.lineTo(this.width, proj.y);
      ctx.stroke();
    }
    
    // Draw Strike Zone Holographic Target (Z=100)
    // In our coordinate space, Home Plate is at Z=100, strike zone is centered at X=0, Y=70
    // Width is roughly -30 to 30, height is 40 to 100
    const szTopLeft = this.project(-25, 100, 100);
    const szBottomRight = this.project(25, 45, 100);
    
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(
      szTopLeft.x,
      szTopLeft.y,
      szBottomRight.x - szTopLeft.x,
      szBottomRight.y - szTopLeft.y
    );
    ctx.setLineDash([]); // Reset
    
    // Draw Strike Zone corner brackets for cyber flair
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.5)';
    ctx.lineWidth = 1.5;
    const len = 10;
    
    // Top Left Corner
    ctx.beginPath();
    ctx.moveTo(szTopLeft.x, szTopLeft.y + len);
    ctx.lineTo(szTopLeft.x, szTopLeft.y);
    ctx.lineTo(szTopLeft.x + len, szTopLeft.y);
    ctx.stroke();
    
    // Top Right Corner
    ctx.beginPath();
    ctx.moveTo(szBottomRight.x - len, szTopLeft.y);
    ctx.lineTo(szBottomRight.x, szTopLeft.y);
    ctx.lineTo(szBottomRight.x, szTopLeft.y + len);
    ctx.stroke();
    
    // Bottom Left Corner
    ctx.beginPath();
    ctx.moveTo(szTopLeft.x, szBottomRight.y - len);
    ctx.lineTo(szTopLeft.x, szBottomRight.y);
    ctx.lineTo(szTopLeft.x + len, szBottomRight.y);
    ctx.stroke();
    
    // Bottom Right Corner
    ctx.beginPath();
    ctx.moveTo(szBottomRight.x - len, szBottomRight.y);
    ctx.lineTo(szBottomRight.x, szBottomRight.y);
    ctx.lineTo(szBottomRight.x, szBottomRight.y - len);
    ctx.stroke();
    
    // Draw Catcher Box / Home base lines at ground level Z=100
    const hbLeft = this.project(-30, 0, 100);
    const hbRight = this.project(30, 0, 100);
    const hbBack = this.project(0, 0, 103);
    
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hbLeft.x, hbLeft.y);
    ctx.lineTo(hbRight.x, hbRight.y);
    ctx.lineTo(hbBack.x, hbBack.y);
    ctx.closePath();
    ctx.stroke();
  }
}
