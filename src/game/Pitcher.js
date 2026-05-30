/**
 * CYBER PITCHER SYSTEM
 * Renders a holographic wireframe android pitcher at Z=0.
 * Animates the pitching motion and controls the timing of ball release.
 */

const PITCHER_STATES = {
  IDLE: 'IDLE',
  WINDUP: 'WINDUP',
  RELEASE: 'RELEASE',
  FOLLOW_THROUGH: 'FOLLOW_THROUGH'
};

export class Pitcher {
  constructor(engine, ball) {
    this.engine = engine;
    this.ball = ball;
    
    // Position at depth Z=0
    this.x = 0;
    this.y = 0; // Ground level
    this.z = 2; // Slightly ahead of Z=0
    
    this.state = PITCHER_STATES.IDLE;
    this.stateTimer = 0;
    
    // Animation keyframe variables
    this.pitchChargePct = 0; // Windup preparation scale
    this.releaseProgress = 0; // Release animation progress
    
    // Base skeletal joints for wireframe drawing (local offsets)
    this.joints = {
      head: { x: 0, y: 75 },
      chest: { x: 0, y: 55 },
      pelvis: { x: 0, y: 35 },
      lShoulder: { x: -12, y: 60 },
      rShoulder: { x: 12, y: 60 },
      lElbow: { x: -20, y: 48 },
      rElbow: { x: 20, y: 48 },
      lHand: { x: -22, y: 35 },
      rHand: { x: 22, y: 35 }, // Throwing hand
      lHip: { x: -8, y: 35 },
      rHip: { x: 8, y: 35 },
      lKnee: { x: -10, y: 18 },
      rKnee: { x: 10, y: 18 },
      lFoot: { x: -12, y: 0 },
      rFoot: { x: 12, y: 0 }
    };
    
    // Active joints rendering state
    this.activeJoints = JSON.parse(JSON.stringify(this.joints));
  }

  reset() {
    this.state = PITCHER_STATES.IDLE;
    this.stateTimer = 0;
    this.pitchChargePct = 0;
    this.releaseProgress = 0;
  }

  /**
   * Triggers the pitcher's throw sequence
   * @param {string} pitchType
   * @param {number} speed
   * @param {number} targetX
   * @param {number} targetY
   */
  startPitch(pitchType, speed, targetX, targetY) {
    this.state = PITCHER_STATES.WINDUP;
    this.stateTimer = 0;
    
    // Cache the target pitch parameters
    this.nextPitch = {
      type: pitchType,
      speed: speed,
      tx: targetX,
      ty: targetY
    };
  }

  update(dt) {
    this.stateTimer += dt;
    
    switch (this.state) {
      case PITCHER_STATES.IDLE:
        this.animateIdle(dt);
        break;
      case PITCHER_STATES.WINDUP:
        this.animateWindup(dt);
        break;
      case PITCHER_STATES.RELEASE:
        this.animateRelease(dt);
        break;
      case PITCHER_STATES.FOLLOW_THROUGH:
        this.animateFollowThrough(dt);
        break;
    }
  }

  animateIdle(dt) {
    // Gentle breathing cycle
    const breathe = Math.sin(this.stateTimer * 2.5) * 1.5;
    
    this.activeJoints.head.y = this.joints.head.y + breathe;
    this.activeJoints.chest.y = this.joints.chest.y + breathe * 0.8;
    this.activeJoints.lShoulder.y = this.joints.lShoulder.y + breathe * 0.5;
    this.activeJoints.rShoulder.y = this.joints.rShoulder.y + breathe * 0.5;
    
    // Normal hand positions
    this.activeJoints.lHand.x = this.joints.lHand.x;
    this.activeJoints.lHand.y = this.joints.lHand.y + breathe * 0.5;
    this.activeJoints.rHand.x = this.joints.rHand.x;
    this.activeJoints.rHand.y = this.joints.rHand.y + breathe * 0.5;
    
    this.activeJoints.lElbow.x = this.joints.lElbow.x;
    this.activeJoints.lElbow.y = this.joints.lElbow.y + breathe * 0.5;
    this.activeJoints.rElbow.x = this.joints.rElbow.x;
    this.activeJoints.rElbow.y = this.joints.rElbow.y + breathe * 0.5;
    
    // Feet stable on ground
    this.activeJoints.lFoot.y = 0;
    this.activeJoints.rFoot.y = 0;
  }

  animateWindup(dt) {
    // Duration of windup: 0.8 seconds
    const duration = 0.8;
    let pct = this.stateTimer / duration;
    if (pct > 1) pct = 1;
    
    this.pitchChargePct = pct;
    
    // Pitcher winds up: 
    // - Right hand pulls way back and up
    // - Left leg lifts up high
    // - Body tilts backward
    
    // Left Leg Lift
    this.activeJoints.lKnee.y = this.joints.lKnee.y + pct * 20;
    this.activeJoints.lKnee.x = this.joints.lKnee.x + pct * 6;
    this.activeJoints.lFoot.y = pct * 22;
    this.activeJoints.lFoot.x = this.joints.lFoot.x + pct * 4;
    
    // Right arm pulls back (Throwing arm)
    this.activeJoints.rShoulder.y = this.joints.rShoulder.y + pct * 4;
    this.activeJoints.rElbow.x = this.joints.rElbow.x + pct * 10;
    this.activeJoints.rElbow.y = this.joints.rElbow.y + pct * 24;
    this.activeJoints.rHand.x = this.joints.rHand.x - pct * 6; // Moves back
    this.activeJoints.rHand.y = this.joints.rHand.y + pct * 42; // Moves high up
    
    // Body tilt back
    this.activeJoints.head.x = -pct * 6;
    this.activeJoints.chest.x = -pct * 4;
    this.activeJoints.pelvis.x = -pct * 2;
    
    if (this.stateTimer >= duration) {
      this.state = PITCHER_STATES.RELEASE;
      this.stateTimer = 0;
    }
  }

  animateRelease(dt) {
    // Fast whip down: 0.15 seconds
    const duration = 0.15;
    let pct = this.stateTimer / duration;
    if (pct > 1) pct = 1;
    
    this.releaseProgress = pct;
    
    // Pitcher snaps forward:
    // - Left leg drives forward and down to the ground
    // - Right arm whips forward violently
    // - Body leans way forward
    
    // Left leg plants
    this.activeJoints.lKnee.y = this.joints.lKnee.y - (1 - pct) * 20;
    this.activeJoints.lKnee.x = this.joints.lKnee.x - pct * 12; // Extends forward
    this.activeJoints.lFoot.y = (1 - pct) * 22; // Back to ground
    this.activeJoints.lFoot.x = this.joints.lFoot.x - pct * 16; // Plants forward
    
    // Right arm whips forward (violent drop)
    // From high/back (rHand: 16, 77) to low/front (rHand: -15, 30)
    const startRx = this.joints.rHand.x - 6;
    const startRy = this.joints.rHand.y + 42;
    const endRx = -18;
    const endRy = 32;
    
    this.activeJoints.rHand.x = startRx + (endRx - startRx) * pct;
    this.activeJoints.rHand.y = startRy + (endRy - startRy) * pct;
    
    this.activeJoints.rElbow.x = 8 + ( -6 - 8) * pct;
    this.activeJoints.rElbow.y = 72 + (44 - 72) * pct;
    
    // Body lunges forward
    this.activeJoints.head.x = -6 + (14 - -6) * pct;
    this.activeJoints.chest.x = -4 + (10 - -4) * pct;
    
    // TRIGGER ACTUAL BALL RELEASE: Right at the peak of the whip (pct = 0.8)
    if (pct >= 0.8 && this.nextPitch) {
      // Release point is current right hand position projected
      const rx = this.activeJoints.rHand.x;
      const ry = this.activeJoints.rHand.y;
      
      this.ball.throw(
        this.nextPitch.type,
        this.nextPitch.speed,
        this.nextPitch.tx,
        this.nextPitch.ty
      );
      
      // Override ball initial location to release hand coordinates
      // Convert joints X,Y (local centered) to 3D space.
      // Pitcher is at X=0, Z=this.z (2). Local coords map: 1 joint unit is 0.1 meters.
      this.ball.x = rx * 0.18;
      this.ball.y = ry * 0.95; // Scale height slightly to align
      this.ball.z = this.z;
      
      this.nextPitch = null; // Clear so it only triggers once
    }
    
    if (this.stateTimer >= duration) {
      this.state = PITCHER_STATES.FOLLOW_THROUGH;
      this.stateTimer = 0;
    }
  }

  animateFollowThrough(dt) {
    // 0.4 seconds to slow down and return to IDLE
    const duration = 0.4;
    let pct = this.stateTimer / duration;
    if (pct > 1) pct = 1;
    
    // Let joints ease back from release positions to idle positions
    const ease = 1 - pct; // 1 to 0
    
    // Return head/chest to center
    this.activeJoints.head.x = 14 * ease;
    this.activeJoints.chest.x = 10 * ease;
    
    // Throwing arm follow through (recovers back to side)
    const endRx = -18;
    const endRy = 32;
    this.activeJoints.rHand.x = this.joints.rHand.x + (endRx - this.joints.rHand.x) * ease;
    this.activeJoints.rHand.y = this.joints.rHand.y + (endRy - this.joints.rHand.y) * ease;
    
    // Leg recovers
    this.activeJoints.lFoot.x = this.joints.lFoot.x + (-16 - this.joints.lFoot.x) * ease;
    this.activeJoints.lKnee.x = this.joints.lKnee.x + (-12 - this.joints.lKnee.x) * ease;
    
    if (this.stateTimer >= duration) {
      this.state = PITCHER_STATES.IDLE;
      this.stateTimer = 0;
    }
  }

  draw(ctx) {
    ctx.save();
    
    // Set wireframe holographic color (Cyan/Blue neon)
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
    
    // In our coordinate space: Pitcher is at Z=this.z (which is 2)
    // We project each active joint to screen coordinates
    const screenJoints = {};
    for (const [key, joint] of Object.entries(this.activeJoints)) {
      // Convert local coordinate offsets to 3D coords:
      // X = joint.x * scaling factor (to match meters)
      // Y = joint.y * scaling factor
      // Z = this.z
      const x3d = this.x + joint.x * 0.15;
      const y3d = this.y + joint.y * 0.95;
      screenJoints[key] = this.engine.project(x3d, y3d, this.z);
    }
    
    // Draw joints as glowing neon points
    ctx.fillStyle = '#ffffff';
    for (const key of Object.keys(screenJoints)) {
      const sj = screenJoints[key];
      const r = 2.5 * sj.scale;
      if (r < 0.5) continue;
      
      ctx.beginPath();
      ctx.arc(sj.x, sj.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw wireframe connections (bones)
    const drawBone = (j1, j2) => {
      const pt1 = screenJoints[j1];
      const pt2 = screenJoints[j2];
      if (!pt1 || !pt2) return;
      
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    };
    
    // Torso & Head
    drawBone('head', 'chest');
    drawBone('chest', 'pelvis');
    
    // Shoulders
    drawBone('chest', 'lShoulder');
    drawBone('chest', 'rShoulder');
    
    // Left Arm
    drawBone('lShoulder', 'lElbow');
    drawBone('lElbow', 'lHand');
    
    // Right Arm (Throwing)
    drawBone('rShoulder', 'rElbow');
    drawBone('rElbow', 'rHand');
    
    // Hips
    drawBone('pelvis', 'lHip');
    drawBone('pelvis', 'rHip');
    
    // Left Leg
    drawBone('lHip', 'lKnee');
    drawBone('lKnee', 'lFoot');
    
    // Right Leg
    drawBone('rHip', 'rKnee');
    drawBone('rKnee', 'rFoot');
    
    // Highlight charging energy core inside chest if winding up
    if (this.state === PITCHER_STATES.WINDUP) {
      const chest = screenJoints['chest'];
      const energyRadius = this.pitchChargePct * 8 * chest.scale;
      
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 12;
      
      ctx.beginPath();
      ctx.arc(chest.x, chest.y, energyRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}
