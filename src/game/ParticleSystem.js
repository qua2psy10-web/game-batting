/**
 * CYBER PARTICLE SYSTEM
 * Handles high-performance visual particles in pseudo-3D space.
 * Creates spark splashes on hits, giant digital fireworks on Home Runs, 
 * and ambient dust floating through the cyber stadium.
 */

class Particle {
  constructor(x, y, z, vx, vy, vz, color, size, life, gravity = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.color = color;
    this.size = size;
    this.maxLife = life;
    this.life = life; // Remaining lifetime in seconds
    this.gravity = gravity;
  }

  update(dt) {
    this.vy -= this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.life -= dt;
  }
}

export class ParticleSystem {
  constructor(engine) {
    this.engine = engine;
    this.particles = [];
  }

  reset() {
    this.particles = [];
  }

  update(dt) {
    // Update and filter out dead particles
    this.particles = this.particles.filter(p => {
      p.update(dt);
      return p.life > 0;
    });
  }

  draw(ctx) {
    ctx.save();
    
    // Sort particles by Z-depth descending so further particles are drawn first (painters algorithm)
    const sorted = [...this.particles].sort((a, b) => b.z - a.z);
    
    for (const p of sorted) {
      const proj = this.engine.project(p.x, p.y, p.z);
      
      // Calculate opacity based on remaining lifetime
      const opacity = Math.max(0, p.life / p.maxLife);
      const size = p.size * proj.scale * 6;
      if (size < 0.2) continue;
      
      ctx.globalAlpha = opacity;
      ctx.fillStyle = p.color;
      
      // Cyber glow effect
      ctx.shadowColor = p.color;
      ctx.shadowBlur = size * 1.8;
      
      ctx.beginPath();
      // Draw small squares or circles based on size for cyberpunk style
      if (size > 3) {
        ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // High speed rect rendering
        ctx.fillRect(proj.x - size/2, proj.y - size/2, size, size);
      }
    }
    
    ctx.restore();
  }

  /**
   * Spawn spark particles on bat-ball contact
   * @param {number} x3d - Contact 3D position
   * @param {number} y3d 
   * @param {number} z3d 
   * @param {string} quality - 'PERFECT', 'GREAT', 'GOOD'
   */
  spawnHitSparks(x3d, y3d, z3d, quality) {
    let count = 25;
    let baseColor = '#00f0ff'; // GOOD/GREAT
    let speed = 40;
    let size = 2.5;
    
    if (quality === 'PERFECT') {
      count = 60;
      baseColor = '#fffb00'; // Yellow
      speed = 70;
      size = 3.5;
    } else if (quality === 'GREAT') {
      count = 40;
      baseColor = '#00f0ff'; // Cyan
      speed = 50;
      size = 2.8;
    } else if (quality === 'GOOD') {
      count = 20;
      baseColor = '#ff007f'; // Pink
      speed = 30;
      size = 2.0;
    }
    
    // Spawn radial explosion of sparks
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI * 0.5; // Vertical distribution
      
      const velocityMag = (0.3 + Math.random() * 0.7) * speed;
      
      const vx = velocityMag * Math.cos(angle) * Math.cos(pitch);
      const vy = velocityMag * Math.sin(pitch);
      const vz = velocityMag * Math.sin(angle) * Math.cos(pitch);
      
      // Life between 0.3 and 0.8 seconds
      const life = 0.35 + Math.random() * 0.45;
      
      const color = Math.random() > 0.4 ? baseColor : '#ffffff';
      
      this.particles.push(
        new Particle(
          x3d, y3d, z3d,
          vx, vy, vz,
          color, size, life,
          9.8 // Small gravity drop
        )
      );
    }
  }

  /**
   * Spawn fireworks in the background (Z=0..10) on Home Run
   * @param {number} count - number of firework bursts
   */
  spawnHomeRunFireworks(count = 3) {
    const colors = ['#ff007f', '#00f0ff', '#39ff14', '#fffb00', '#9d00ff'];
    
    for (let f = 0; f < count; f++) {
      // Delay bursts slightly
      setTimeout(() => {
        if (this.engine.isActive === false) return; // Prevent spawning if stopped
        
        // Random spot in outer background (Z=10, Y=80..180, X=-100..100)
        const fx = (Math.random() - 0.5) * 160;
        const fy = 90 + Math.random() * 80;
        const fz = 5 + Math.random() * 15;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Burst particle count
        const particlesCount = 50;
        for (let i = 0; i < particlesCount; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos((Math.random() * 2) - 1);
          
          const speed = 25 + Math.random() * 25;
          const vx = speed * Math.sin(phi) * Math.cos(theta);
          const vy = speed * Math.sin(phi) * Math.sin(theta);
          const vz = speed * Math.cos(phi);
          
          const life = 1.0 + Math.random() * 0.8;
          const size = 1.8 + Math.random() * 2;
          
          this.particles.push(
            new Particle(
              fx, fy, fz,
              vx, vy, vz,
              color, size, life,
              4.0 // Light downward gravitational arc
            )
          );
        }
      }, f * 300); // 300ms intervals
    }
  }

  /**
   * Spawns slowly floating holographic cyber-dust through the arena
   */
  spawnAmbientDust(count = 2) {
    // Cap maximum ambient particles to avoid performance degradation on mobile
    if (this.particles.length > 120) return;
    
    for (let i = 0; i < count; i++) {
      // Spawn at random depth, random width, and floor level
      const ax = (Math.random() - 0.5) * 180;
      const ay = Math.random() * 140;
      const az = Math.random() * 100;
      
      // Floating velocity
      const vx = (Math.random() - 0.5) * 4;
      const vy = 2 + Math.random() * 6; // Gently floats upwards
      const vz = (Math.random() - 0.5) * 4;
      
      const life = 3.0 + Math.random() * 4.0;
      const size = 0.5 + Math.random() * 1.0;
      
      const color = Math.random() > 0.5 ? '#00f0ff' : '#ff007f';
      
      this.particles.push(
        new Particle(
          ax, ay, az,
          vx, vy, vz,
          color, size, life,
          -1.0 // Anti-gravity: floats upward
        )
      );
    }
  }
}
