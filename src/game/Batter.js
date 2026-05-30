/**
 * CYBER BATTER SYSTEM
 * Manages the user's aiming cursor (Meat Cursor), swing mechanics, 
 * swing visual animations (energy bat trail), and impact calculations.
 */

export class Batter {
  constructor(engine, ball) {
    this.engine = engine;
    this.ball = ball;
    
    // Meet Cursor Coordinates (in pseudo-3D space at Z=100)
    // Coords align to Strike Zone bounds: X approx [-45, 45], Y approx [35, 105]
    this.cursorX = 0;
    this.cursorY = 70; // Center of strike zone
    
    this.isSwinging = false;
    this.swingProgress = 0; // 0 to 1
    this.swingDuration = 0.16; // Very fast swing (160ms) for responsiveness
    this.swingTimer = 0;
    this.hasJudged = false; // Prevents double hitting on same swing
    
    // Normal contact area parameters (Meat radius)
    this.meatRadius = 14; 
    
    // For rendering bat swing arc
    this.batAngle = Math.PI; // Swings from right to left (PI to 0)
    
    // Cached feedback for rendering hit effects
    this.lastHitResult = null;
  }

  reset() {
    this.cursorX = 0;
    this.cursorY = 70;
    this.isSwinging = false;
    this.swingProgress = 0;
    this.swingTimer = 0;
    this.hasJudged = false;
    this.lastHitResult = null;
  }

  /**
   * Update aiming cursor from joystick inputs (-1.0 to 1.0)
   * @param {number} inputX 
   * @param {number} inputY 
   */
  setAim(inputX, inputY) {
    // Map normal input to strike zone extension range
    const maxRangeX = 55;
    const minY = 30;
    const maxY = 110;
    
    this.cursorX = inputX * maxRangeX;
    
    // Y input (usually -1 down to 1 up)
    // Map -1..1 to minY..maxY
    const midY = (minY + maxY) / 2;
    const halfRangeY = (maxY - minY) / 2;
    this.cursorY = midY + inputY * halfRangeY;
  }

  swing() {
    if (this.isSwinging) return; // Prevent double swing
    this.isSwinging = true;
    this.swingProgress = 0;
    this.swingTimer = 0;
    this.hasJudged = false;
  }

  update(dt) {
    if (!this.isSwinging) return;
    
    this.swingTimer += dt;
    this.swingProgress = this.swingTimer / this.swingDuration;
    
    if (this.swingProgress > 1.0) {
      this.swingProgress = 1.0;
      this.isSwinging = false;
    }
    
    // Impact calculations trigger at the peak of the swing (progress around 0.5)
    if (this.isSwinging && this.swingProgress >= 0.45 && !this.hasJudged && !this.ball.isBatted && !this.ball.isDead) {
      this.checkCollision();
    }
  }

  checkCollision() {
    this.hasJudged = true;
    
    // Get ball position
    const bx = this.ball.x;
    const by = this.ball.y;
    const bz = this.ball.z;
    
    // Ideal batting depth (Z) is 96 to 101.
    // Check if ball is in the hitting frame.
    // If ball is too far (Z < 92) or too past (Z > 105), it's automatically a miss.
    const timingDiff = Math.abs(bz - 97.5);
    
    if (timingDiff > 6.0) {
      // Too early or too late
      this.lastHitResult = { type: 'MISS', message: bz < 92.5 ? 'TOO EARLY' : 'TOO LATE', speed: 0, dist: 0 };
      this.ball.isSwingMiss = true;
      return;
    }
    
    // Calculate distance on the X-Y target plate (Z=100)
    const dx = bx - this.cursorX;
    const dy = by - this.cursorY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Evaluation Logic
    // Perfect: Distance < 6, TimingDiff < 2
    // Great: Distance < 12, TimingDiff < 4
    // Good: Distance < 22, TimingDiff < 5.5
    
    let score = 0;
    let hitType = 'MISS';
    let label = 'MISS';
    
    if (distance < 7.5 && timingDiff < 2.0) {
      hitType = 'PERFECT';
      label = 'PERFECT!';
      score = 3;
    } else if (distance < 15.0 && timingDiff < 3.8) {
      hitType = 'GREAT';
      label = 'GREAT!';
      score = 2;
    } else if (distance < 24.0 && timingDiff < 5.8) {
      hitType = 'GOOD';
      label = 'GOOD';
      score = 1;
    }
    
    if (score > 0) {
      // HIT PHYSICAL FORMULATION
      // Calculate launch speed (120 to 195 km/h depending on contact quality)
      const baseSpeed = 110 + score * 20; // 130 to 170 base
      // Random variance + contact distance scaling
      const accuracyModifier = (1 - (distance / 25)) * 15;
      const launchSpeed = baseSpeed + accuracyModifier + Math.random() * 10;
      
      // Calculate launch angle (Y trajectory)
      // Best launch angle for home runs is 25-33 degrees.
      // If cursor is slightly below the ball center, it creates backspin/lift (ideal angle)
      // If cursor is above ball, it creates a grounder (low angle)
      let launchAngle = 28; // default perfect
      
      if (hitType === 'PERFECT') {
        launchAngle = 27 + (Math.random() - 0.5) * 6; // 24 to 30 degrees (optimal)
      } else {
        const yDiff = by - this.cursorY; // Positive = ball is higher (under-cut)
        // Under-cut lifts ball up. Over-cut drives it down.
        // Map yDiff to launch angle: yDiff of 10 -> +15 degrees
        launchAngle = 20 + yDiff * 1.5 + (Math.random() - 0.5) * 12;
        // Clamp to logical limits
        launchAngle = Math.max(-5, Math.min(55, launchAngle));
      }
      
      // Calculate horizontal launch direction (Left/Right field)
      // Perfect timing (bz = 97.5) goes to center field (0 degrees).
      // Early swing (bz < 97.5) pulls the ball (Left field for righty, let's assume right-handed batter: early = left, late = right)
      // Late swing (bz > 97.5) pushes the ball (Right field)
      const zOffset = 97.5 - bz; // Negative is late, positive is early
      const launchDirection = zOffset * 7.5 + (Math.random() - 0.5) * 8; // Deg offset
      
      // Execute the ball strike physics
      this.ball.bat(launchSpeed, launchAngle, launchDirection);
      
      // Save result for HUD/scoring
      this.lastHitResult = {
        type: hitType,
        message: label,
        speed: Math.round(launchSpeed),
        angle: Math.round(launchAngle),
        dir: launchDirection
      };
      
      // Trigger Engine freeze / camera shake based on impact power
      this.engine.shake(6 + score * 4, 3 + score * 3);
      this.engine.triggerHitStop(4 + score * 3);
    } else {
      this.lastHitResult = { type: 'MISS', message: 'MISS', speed: 0, dist: 0 };
      this.ball.isSwingMiss = true;
    }
  }

  draw(ctx) {
    // 1. Draw Hologram Strike Zone Reticle / Cursor (Z=100)
    this.drawCursor(ctx);
    
    // 2. Draw Bat swing sweep trails if swinging
    if (this.isSwinging) {
      this.drawSwing(ctx);
    }
  }

  drawCursor(ctx) {
    const proj = this.engine.project(this.cursorX, this.cursorY, 100);
    const cursorRad = this.meatRadius * proj.scale * 6; // Scale of cursor
    
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1.5;
    
    // Outer dashed boundary ring
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, cursorRad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Inner solid core reticle
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, cursorRad * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    
    // Center point
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw crosshair ticks
    const tickLen = 6;
    ctx.beginPath();
    // Left tick
    ctx.moveTo(proj.x - cursorRad * 0.5, proj.y);
    ctx.lineTo(proj.x - cursorRad * 0.5 - tickLen, proj.y);
    // Right tick
    ctx.moveTo(proj.x + cursorRad * 0.5, proj.y);
    ctx.lineTo(proj.x + cursorRad * 0.5 + tickLen, proj.y);
    // Top tick
    ctx.moveTo(proj.x, proj.y - cursorRad * 0.5);
    ctx.lineTo(proj.x, proj.y - cursorRad * 0.5 - tickLen);
    // Bottom tick
    ctx.moveTo(proj.x, proj.y + cursorRad * 0.5);
    ctx.lineTo(proj.x, proj.y + cursorRad * 0.5 + tickLen);
    ctx.stroke();
    
    ctx.restore();
  }

  drawSwing(ctx) {
    // Renders the energy swing arc at Z=96
    // The swing moves across the horizontal plane around cursor position
    const proj = this.engine.project(this.cursorX, this.cursorY, 96);
    
    ctx.save();
    
    // Swing color: Neon pink/purple glowing arc
    ctx.strokeStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 15;
    ctx.lineCap = 'round';
    
    // Swing progression sweep angle
    // Sweep starts from top-right to bottom-left
    // Standard sweep angle span of 120 degrees
    const startAngle = Math.PI * 1.3 - (this.swingProgress * Math.PI * 1.2);
    const endAngle = startAngle + Math.PI * 0.45; // trail arc thickness
    
    const swingRad = 85 * proj.scale;
    
    ctx.lineWidth = 14 * proj.scale;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, swingRad, startAngle, endAngle);
    ctx.stroke();
    
    // Inner white core for lightsaber effect
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4 * proj.scale;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, swingRad, startAngle, endAngle);
    ctx.stroke();
    
    ctx.restore();
  }
}
