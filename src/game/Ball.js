/**
 * CYBER BATTING DERBY - BALL PHYSICAL SYSTEM
 * Simulates a ball's 3D motion path (X, Y, Z). Handles multiple pitch types
 * (Fastball, Curve, Fork, Stealth) and the physics of the batted ball.
 */

export const PITCH_TYPES = {
  FASTBALL: 'FASTBALL',
  CURVEBALL: 'CURVEBALL',
  FORKBALL: 'FORKBALL',
  STEALTH: 'STEALTH' // Cyber Special: Becomes transparent in mid-air
};

export class Ball {
  constructor(engine) {
    this.engine = engine;
    this.reset();
  }

  reset() {
    // 3D coordinates (relative units, mapping to canvas coords via Engine.project)
    this.x = 0;
    this.y = 70; // Pitcher height relative to ground
    this.z = 0;  // 0 = Pitcher plate, 100 = Batter box/catcher plate
    
    // Physics velocities
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    
    this.radius = 1.6; // Base physical radius (meters)
    this.type = PITCH_TYPES.FASTBALL;
    
    // Game states
    this.isBatted = false;
    this.isDead = false;
    this.isSwingMiss = false;
    
    // Pitch configuration
    this.speedKmh = 140;
    this.curveFactor = 0;
    this.dropFactor = 0;
    
    // Stealth status for cyber ball
    this.stealthTimer = 0;
    this.isStealthActive = false;
    
    // Batted ball physics variables
    this.battedVx = 0;
    this.battedVy = 0;
    this.battedVz = 0;
    this.gravity = 9.8 * 2.5; // Accelerated gravity for faster arcade feel
    this.airResistance = 0.05; // Friction/drag
    this.groundY = 0;
    
    // For rendering trails
    this.trail = [];
    this.maxTrailLength = 15;
  }

  /**
   * Throw a new pitch
   * @param {string} type - Pitch type enum
   * @param {number} speed - Pitch speed in km/h (e.g. 130 - 160)
   * @param {number} targetX - Target X coordinate at Z=100 (where it should cross the zone)
   * @param {number} targetY - Target Y coordinate at Z=100
   */
  throw(type, speed = 140, targetX = 0, targetY = 70) {
    this.reset();
    this.type = type;
    this.speedKmh = speed;
    
    // Convert speed from km/h to units of Z per second.
    // Let's map 140 km/h -> 40m/s. Z-length (0 to 100) takes approx 0.5 - 0.7 seconds.
    // 140 km/h = 38.8 m/s. Let's make flight duration around 0.6 seconds.
    const flightDuration = 160 / speed; // Higher speed = shorter flight time
    
    this.vz = 100 / flightDuration; // Velocity in Z
    
    // Initial positions
    this.x = (Math.random() - 0.5) * 10; // Pitcher shifts slightly left/right
    this.y = 80; // Release height
    this.z = 0;
    
    // Calculate required linear velocities to hit targetX and targetY
    this.vx = (targetX - this.x) / flightDuration;
    this.vy = (targetY - this.y) / flightDuration;
    
    // Customize curves/drops based on pitch type
    switch (type) {
      case PITCH_TYPES.CURVEBALL:
        // Slow down slightly, curve hard right/left depending on release
        this.speedKmh *= 0.85;
        this.vz = 100 / (160 / this.speedKmh);
        // Curve factor (acceleration in X)
        // Curves from pitcher side to opposite, let's make it curve right
        const side = Math.random() > 0.5 ? 1 : -1;
        this.curveFactor = 80 * side; // Units/s^2 acceleration
        // Adjust initial vx to compensate curve so it still goes near strike zone
        this.vx -= (this.curveFactor * flightDuration) / 2;
        break;
        
      case PITCH_TYPES.FORKBALL:
        // Falls dramatically in the last 30% of flight
        this.speedKmh *= 0.9;
        this.vz = 100 / (160 / this.speedKmh);
        this.dropFactor = 90; // Downward acceleration in Y
        this.vy += (this.dropFactor * flightDuration) / 2; // Compensate initial angle
        break;
        
      case PITCH_TYPES.STEALTH:
        // Regular speed, but hides visually in mid-air
        this.stealthTimer = 0;
        break;
    }
  }

  /**
   * Strike/hit action simulation
   */
  bat(launchSpeed, launchAngleDeg, launchDirectionDeg) {
    this.isBatted = true;
    
    // Convert angles to radian
    const theta = (launchAngleDeg * Math.PI) / 180; // Up/down angle
    const phi = (launchDirectionDeg * Math.PI) / 180;  // Left/right angle
    
    // Map launchSpeed to velocities.
    // LaunchSpeed is arcade distance scaling.
    // e.g. 180 km/h = 50m/s velocity.
    const velocity = launchSpeed * 0.7; // Velocity magnitude
    
    this.battedVz = -velocity * Math.cos(theta) * Math.cos(phi); // Moves in negative Z (away from batter)
    this.battedVx = velocity * Math.cos(theta) * Math.sin(phi);  // Left/right
    this.battedVy = velocity * Math.sin(theta);                 // Launch upwards
    
    this.trail = []; // Clear pitcher trail
  }

  update(dt) {
    if (this.isDead) return;
    
    // Add current position to trail
    this.trail.push({ x: this.x, y: this.y, z: this.z });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
    
    if (!this.isBatted) {
      // 1. PITCH FLIGHT PHYSICS
      this.z += this.vz * dt;
      
      // Apply pitch type physics deviations
      if (this.type === PITCH_TYPES.CURVEBALL) {
        // Curve gets stronger over time
        this.vx += this.curveFactor * dt;
      } else if (this.type === PITCH_TYPES.FORKBALL) {
        // Apply massive drop factor as it nears the plate (Z > 50)
        if (this.z > 50) {
          const dropIntensity = (this.z - 50) / 50; // 0 to 1
          this.vy -= this.dropFactor * dropIntensity * dt * 2.0;
        }
      } else if (this.type === PITCH_TYPES.STEALTH) {
        // Hide ball between Z = 35 and Z = 75
        this.isStealthActive = (this.z > 30 && this.z < 80);
      }
      
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      
      // If it passes catcher/home plate (Z > 105), it's dead (Strike or Ball)
      if (this.z > 115) {
        this.isDead = true;
      }
    } else {
      // 2. BATTED BALL FLIGHT PHYSICS
      // Apply gravity
      this.battedVy -= this.gravity * dt;
      
      // Apply drag
      this.battedVx *= (1 - this.airResistance * dt);
      this.battedVy *= (1 - this.airResistance * dt);
      this.battedVz *= (1 - this.airResistance * dt);
      
      this.x += this.battedVx * dt;
      this.y += this.battedVy * dt;
      this.z += this.battedVz * dt; // Moving towards Z = 0 and beyond (negative)
      
      // Boundary checks
      // If ball hits the ground (Y <= 0)
      if (this.y <= this.groundY) {
        this.y = this.groundY;
        this.isDead = true;
      }
      
      // Maximum bounds of stadium
      if (this.z < -200 || this.x > 300 || this.x < -300) {
        this.isDead = true;
      }
    }
  }

  draw(ctx) {
    if (this.isDead) return;
    
    // Don't draw if stealth mode is active
    if (!this.isBatted && this.isStealthActive) {
      this.drawStealthGlitch(ctx);
      return;
    }
    
    const proj = this.engine.project(this.x, this.y, this.z);
    
    // Draw ball trail
    this.drawTrail(ctx);
    
    // Base radius scales with perspective projection
    const screenRadius = this.radius * proj.scale * 12;
    if (screenRadius < 1) return;
    
    ctx.save();
    
    // Add glow effect based on pitch or batted status
    if (this.isBatted) {
      // Batted ball glows intensely white/pink
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 12;
      
      const radGrad = ctx.createRadialGradient(
        proj.x, proj.y, 0,
        proj.x, proj.y, screenRadius
      );
      radGrad.addColorStop(0, '#ffffff');
      radGrad.addColorStop(0.3, '#ff80bf');
      radGrad.addColorStop(1, '#ff007f');
      ctx.fillStyle = radGrad;
    } else {
      // Pitch glows depending on pitch type
      let glowColor = '#00f0ff';
      let coreColor = '#ffffff';
      
      if (this.type === PITCH_TYPES.CURVEBALL) {
        glowColor = '#ff00ff';
      } else if (this.type === PITCH_TYPES.FORKBALL) {
        glowColor = '#ffaa00';
      } else if (this.type === PITCH_TYPES.STEALTH) {
        glowColor = '#39ff14';
      }
      
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      
      const radGrad = ctx.createRadialGradient(
        proj.x, proj.y, 0,
        proj.x, proj.y, screenRadius
      );
      radGrad.addColorStop(0, coreColor);
      radGrad.addColorStop(0.7, glowColor);
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radGrad;
    }
    
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, screenRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  drawTrail(ctx) {
    if (this.trail.length < 2) return;
    
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    
    let baseGlow = '#00f0ff';
    if (this.isBatted) {
      baseGlow = '#ff007f';
    } else if (this.type === PITCH_TYPES.CURVEBALL) {
      baseGlow = '#ff00ff';
    } else if (this.type === PITCH_TYPES.FORKBALL) {
      baseGlow = '#ffaa00';
    }
    
    for (let i = 1; i < this.trail.length; i++) {
      const ptA = this.trail[i-1];
      const ptB = this.trail[i];
      
      // Calculate project screen points
      const screenA = this.engine.project(ptA.x, ptA.y, ptA.z);
      const screenB = this.engine.project(ptB.x, ptB.y, ptB.z);
      
      const opacity = (i / this.trail.length) * 0.45;
      ctx.strokeStyle = baseGlow;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 1 + (i / this.trail.length) * 4;
      
      ctx.beginPath();
      ctx.moveTo(screenA.x, screenA.y);
      ctx.lineTo(screenB.x, screenB.y);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // Draw slight visual static glitch for stealth ball in mid-air
  drawStealthGlitch(ctx) {
    if (Math.random() > 0.15) return; // Glitch occasionally
    
    const proj = this.engine.project(this.x, this.y, this.z);
    ctx.save();
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
    ctx.lineWidth = 1;
    
    const glitchW = 12 * proj.scale * 4;
    const glitchH = 2;
    
    ctx.beginPath();
    ctx.moveTo(proj.x - glitchW / 2, proj.y);
    ctx.lineTo(proj.x + glitchW / 2, proj.y);
    ctx.stroke();
    
    ctx.restore();
  }

  /**
   * Calculates actual physical landing distance (meters) when ball hits ground.
   * Simple flat ground physics conversion.
   */
  calculateDistance() {
    if (!this.isBatted) return 0;
    
    // In our coordinate space: Z starts at 100, moves negatively.
    // Calculate total delta Z from home plate (Z=100)
    // Map units of delta Z to actual meters.
    // Let's say Z=100 -> Z=0 is 18.44 meters (pitcher distance)
    // So 1 unit of Z is approx 0.18 meters.
    // For arcade gameplay, let's map: 
    // Home run fence is at Z = -400.
    // Total flight distance (X, Z change from home)
    const dx = this.x; // Starting x was around zone (0)
    const dz = 100 - this.z; // Depth travel from batter plate (100)
    
    // Hypotenuse horizontal distance in arcade units
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    
    // Scale to arcade meters (e.g. 100 units = 120 meters)
    const distanceMeters = horizDist * 1.35;
    
    return Math.round(distanceMeters);
  }
}
