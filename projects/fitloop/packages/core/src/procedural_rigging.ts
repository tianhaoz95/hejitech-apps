import { GifWriter } from "omggif";

export interface Point2D {
  x: number;
  y: number;
}

export interface SkeletonPose {
  pelvis: Point2D;
  midSpine: Point2D;
  chest: Point2D;
  neck: Point2D;
  head: Point2D;
  headRadius?: number;

  nearShoulder: Point2D;
  nearElbow: Point2D;
  nearWrist: Point2D;

  farShoulder: Point2D;
  farElbow: Point2D;
  farWrist: Point2D;

  nearHip: Point2D;
  nearKnee: Point2D;
  nearAnkle: Point2D;

  farHip: Point2D;
  farKnee: Point2D;
  farAnkle: Point2D;

  accessory?: {
    type: "circle";
    center: Point2D;
    radius: number;
    colorIndex: number;
  };
}

export interface RenderOptions {
  width?: number;
  height?: number;
  groundY?: number;
  frameCount?: number;
  frameDelayCs?: number; // hundredths of a second (10 = 100ms)
}

// 8-color palette (must be a power of 2 for GIF format)
export const RIGGING_PALETTE = [
  0xffffff, // 0: White background
  0xe2e8f0, // 1: Ground plane line (slate-200)
  0x94a3b8, // 2: Far limb secondary (slate-400)
  0x64748b, // 3: Far limb main (slate-500)
  0x1e293b, // 4: Near limb / Head (slate-800)
  0x0f172a, // 5: Torso / Spine (slate-900)
  0x38bdf8, // 6: Accent / Joint pivot (sky-400)
  0xf97316, // 7: Sport ball accent (orange-500)
];

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 220;
const DEFAULT_GROUND_Y = 188;

function drawCapsule(
  frame: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  colorIdx: number,
) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - radius - 1));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + radius + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - radius - 1));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + radius + 1));

  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let t = 0;
      if (lenSq > 0.0001) {
        t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const projX = x0 + t * dx;
      const projY = y0 + t * dy;
      const distSq = (x - projX) * (x - projX) + (y - projY) * (y - projY);
      if (distSq <= radius * radius) {
        frame[y * w + x] = colorIdx;
      }
    }
  }
}

function drawCircle(
  frame: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  colorIdx: number,
) {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(w - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(h - 1, Math.ceil(cy + radius + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (distSq <= radius * radius) {
        frame[y * w + x] = colorIdx;
      }
    }
  }
}

function lerpPoint(p1: Point2D, p2: Point2D, t: number): Point2D {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

export function interpolatePose(pA: SkeletonPose, pB: SkeletonPose, t: number): SkeletonPose {
  const res: SkeletonPose = {
    pelvis: lerpPoint(pA.pelvis, pB.pelvis, t),
    midSpine: lerpPoint(pA.midSpine, pB.midSpine, t),
    chest: lerpPoint(pA.chest, pB.chest, t),
    neck: lerpPoint(pA.neck, pB.neck, t),
    head: lerpPoint(pA.head, pB.head, t),
    headRadius: (pA.headRadius ?? 10) + ((pB.headRadius ?? 10) - (pA.headRadius ?? 10)) * t,

    nearShoulder: lerpPoint(pA.nearShoulder, pB.nearShoulder, t),
    nearElbow: lerpPoint(pA.nearElbow, pB.nearElbow, t),
    nearWrist: lerpPoint(pA.nearWrist, pB.nearWrist, t),

    farShoulder: lerpPoint(pA.farShoulder, pB.farShoulder, t),
    farElbow: lerpPoint(pA.farElbow, pB.farElbow, t),
    farWrist: lerpPoint(pA.farWrist, pB.farWrist, t),

    nearHip: lerpPoint(pA.nearHip, pB.nearHip, t),
    nearKnee: lerpPoint(pA.nearKnee, pB.nearKnee, t),
    nearAnkle: lerpPoint(pA.nearAnkle, pB.nearAnkle, t),

    farHip: lerpPoint(pA.farHip, pB.farHip, t),
    farKnee: lerpPoint(pA.farKnee, pB.farKnee, t),
    farAnkle: lerpPoint(pA.farAnkle, pB.farAnkle, t),
  };

  if (pA.accessory && pB.accessory) {
    res.accessory = {
      type: "circle",
      center: lerpPoint(pA.accessory.center, pB.accessory.center, t),
      radius: pA.accessory.radius + (pB.accessory.radius - pA.accessory.radius) * t,
      colorIndex: pA.accessory.colorIndex,
    };
  }

  return res;
}

export function renderPoseFrame(
  pose: SkeletonPose,
  w: number,
  h: number,
  groundY: number,
): Uint8Array {
  const frame = new Uint8Array(w * h);
  frame.fill(0); // white background

  // 1. Subtle ground reference line
  drawCapsule(frame, w, h, 20, groundY, w - 20, groundY, 1.2, 1);

  // 2. Far limbs (rendered first with lighter slate for depth)
  // Far leg: hip -> knee -> ankle
  drawCapsule(frame, w, h, pose.farHip.x, pose.farHip.y, pose.farKnee.x, pose.farKnee.y, 4, 3);
  drawCapsule(frame, w, h, pose.farKnee.x, pose.farKnee.y, pose.farAnkle.x, pose.farAnkle.y, 3.5, 3);
  // Far arm: shoulder -> elbow -> wrist
  drawCapsule(frame, w, h, pose.farShoulder.x, pose.farShoulder.y, pose.farElbow.x, pose.farElbow.y, 3.5, 3);
  drawCapsule(frame, w, h, pose.farElbow.x, pose.farElbow.y, pose.farWrist.x, pose.farWrist.y, 3, 3);

  // 3. Torso & Spine (curved articulate segments)
  drawCapsule(frame, w, h, pose.pelvis.x, pose.pelvis.y, pose.midSpine.x, pose.midSpine.y, 5.5, 5);
  drawCapsule(frame, w, h, pose.midSpine.x, pose.midSpine.y, pose.chest.x, pose.chest.y, 6, 5);
  drawCapsule(frame, w, h, pose.chest.x, pose.chest.y, pose.neck.x, pose.neck.y, 4.5, 5);

  // 4. Head
  const hr = pose.headRadius ?? 10;
  drawCircle(frame, w, h, pose.head.x, pose.head.y, hr, 4);

  // 5. Near limbs (darker slate with anatomical thickness)
  // Near leg: hip -> knee -> ankle
  drawCapsule(frame, w, h, pose.nearHip.x, pose.nearHip.y, pose.nearKnee.x, pose.nearKnee.y, 5, 4);
  drawCapsule(frame, w, h, pose.nearKnee.x, pose.nearKnee.y, pose.nearAnkle.x, pose.nearAnkle.y, 4.5, 4);
  // Near arm: shoulder -> elbow -> wrist
  drawCapsule(frame, w, h, pose.nearShoulder.x, pose.nearShoulder.y, pose.nearElbow.x, pose.nearElbow.y, 4.5, 4);
  drawCapsule(frame, w, h, pose.nearElbow.x, pose.nearElbow.y, pose.nearWrist.x, pose.nearWrist.y, 4, 4);

  // 6. Joint accent indicators (cyan dots for biomechanical pivots)
  drawCircle(frame, w, h, pose.nearShoulder.x, pose.nearShoulder.y, 2.2, 6);
  drawCircle(frame, w, h, pose.nearElbow.x, pose.nearElbow.y, 2.0, 6);
  drawCircle(frame, w, h, pose.nearHip.x, pose.nearHip.y, 2.4, 6);
  drawCircle(frame, w, h, pose.nearKnee.x, pose.nearKnee.y, 2.2, 6);

  // 7. Accessory (e.g. basketball)
  if (pose.accessory) {
    drawCircle(
      frame,
      w,
      h,
      pose.accessory.center.x,
      pose.accessory.center.y,
      pose.accessory.radius,
      pose.accessory.colorIndex,
    );
  }

  return frame;
}

export function renderKeyframeCycleGif(
  poseA: SkeletonPose,
  poseB: SkeletonPose,
  opts?: RenderOptions,
): Uint8Array {
  const w = opts?.width ?? DEFAULT_WIDTH;
  const h = opts?.height ?? DEFAULT_HEIGHT;
  const groundY = opts?.groundY ?? DEFAULT_GROUND_Y;
  const frameCount = opts?.frameCount ?? 16;
  const delay = opts?.frameDelayCs ?? 9; // 90ms per frame

  const maxBufSize = w * h * (frameCount + 4) + 1024;
  const outBuf = new Uint8Array(maxBufSize);
  const writer = new GifWriter(outBuf, w, h, { loop: 0, palette: RIGGING_PALETTE });

  for (let i = 0; i < frameCount; i++) {
    // Sinusoidal easing across a forward-and-back loop: 0 -> 1 -> 0
    const phase = (i / frameCount) * 2 * Math.PI;
    const t = (1 - Math.cos(phase)) / 2; // oscillates smoothly between 0 and 1
    const pose = interpolatePose(poseA, poseB, t);
    const frame = renderPoseFrame(pose, w, h, groundY);

    writer.addFrame(0, 0, w, h, frame as unknown as number[], {
      delay,
      palette: RIGGING_PALETTE,
    });
  }

  const bytesWritten = writer.end();
  return outBuf.subarray(0, bytesWritten);
}

// ---------------------------------------------------------------- Presets

/**
 * Cat-Cow mobility preset:
 * Pose Cow: Mid-spine dips downward, pelvis tilts anteriorly, head lifts looking forward/up.
 * Pose Cat: Mid-spine arches strongly upward, pelvis tucks posteriorly, head rounds down toward chest.
 */
export const PRESET_CAT_COW: { cow: SkeletonPose; cat: SkeletonPose } = {
  cow: {
    pelvis: { x: 105, y: 135 },
    midSpine: { x: 145, y: 145 }, // dipped down (lordosis)
    chest: { x: 178, y: 132 },
    neck: { x: 195, y: 118 },
    head: { x: 212, y: 100 },     // head lifted up
    headRadius: 10,

    nearShoulder: { x: 180, y: 132 },
    nearElbow: { x: 182, y: 160 },
    nearWrist: { x: 184, y: 188 },

    farShoulder: { x: 172, y: 130 },
    farElbow: { x: 174, y: 158 },
    farWrist: { x: 176, y: 188 },

    nearHip: { x: 105, y: 135 },
    nearKnee: { x: 105, y: 188 },
    nearAnkle: { x: 70, y: 188 },

    farHip: { x: 97, y: 133 },
    farKnee: { x: 97, y: 188 },
    farAnkle: { x: 62, y: 188 },
  },
  cat: {
    pelvis: { x: 105, y: 130 },
    midSpine: { x: 140, y: 104 }, // arched up high (kyphosis)
    chest: { x: 176, y: 124 },
    neck: { x: 190, y: 135 },
    head: { x: 195, y: 152 },     // head tucked down toward knees
    headRadius: 10,

    nearShoulder: { x: 180, y: 130 },
    nearElbow: { x: 181, y: 160 },
    nearWrist: { x: 184, y: 188 },

    farShoulder: { x: 172, y: 128 },
    farElbow: { x: 173, y: 158 },
    farWrist: { x: 176, y: 188 },

    nearHip: { x: 105, y: 130 },
    nearKnee: { x: 105, y: 188 },
    nearAnkle: { x: 70, y: 188 },

    farHip: { x: 97, y: 128 },
    farKnee: { x: 97, y: 188 },
    farAnkle: { x: 62, y: 188 },
  },
};

/**
 * Bird-Dog core stability preset:
 * Base: Quadruped pose with stable torso.
 * Extended: Near arm reaches straight forward horizontally, far leg reaches straight back horizontally.
 */
export const PRESET_BIRD_DOG: { base: SkeletonPose; extended: SkeletonPose } = {
  base: {
    pelvis: { x: 110, y: 135 },
    midSpine: { x: 145, y: 132 },
    chest: { x: 180, y: 132 },
    neck: { x: 198, y: 125 },
    head: { x: 212, y: 118 },
    headRadius: 10,

    nearShoulder: { x: 180, y: 132 },
    nearElbow: { x: 182, y: 160 },
    nearWrist: { x: 184, y: 188 },

    farShoulder: { x: 172, y: 130 },
    farElbow: { x: 174, y: 158 },
    farWrist: { x: 176, y: 188 },

    nearHip: { x: 110, y: 135 },
    nearKnee: { x: 110, y: 188 },
    nearAnkle: { x: 75, y: 188 },

    farHip: { x: 102, y: 133 },
    farKnee: { x: 102, y: 188 },
    farAnkle: { x: 67, y: 188 },
  },
  extended: {
    pelvis: { x: 110, y: 134 },
    midSpine: { x: 145, y: 132 },
    chest: { x: 180, y: 132 },
    neck: { x: 198, y: 125 },
    head: { x: 212, y: 118 },
    headRadius: 10,

    // Near arm reaches straight forward horizontally in line with spine
    nearShoulder: { x: 180, y: 132 },
    nearElbow: { x: 218, y: 130 },
    nearWrist: { x: 254, y: 128 },

    // Far arm remains firmly planted on ground
    farShoulder: { x: 172, y: 130 },
    farElbow: { x: 174, y: 158 },
    farWrist: { x: 176, y: 188 },

    // Near leg remains planted
    nearHip: { x: 110, y: 135 },
    nearKnee: { x: 110, y: 188 },
    nearAnkle: { x: 75, y: 188 },

    // Far leg reaches straight back horizontally in line with spine
    farHip: { x: 102, y: 133 },
    farKnee: { x: 62, y: 131 },
    farAnkle: { x: 22, y: 130 },
  },
};

/**
 * Child's Pose (Balasana) relaxation preset:
 * Upright: Kneeling quadruped.
 * Sinking: Hips sink down onto heels, arms stretch long forward, forehead rests near floor.
 */
export const PRESET_CHILDS_POSE: { upright: SkeletonPose; folded: SkeletonPose } = {
  upright: {
    pelvis: { x: 110, y: 140 },
    midSpine: { x: 145, y: 136 },
    chest: { x: 178, y: 134 },
    neck: { x: 195, y: 126 },
    head: { x: 210, y: 118 },
    headRadius: 10,

    nearShoulder: { x: 178, y: 134 },
    nearElbow: { x: 180, y: 160 },
    nearWrist: { x: 182, y: 188 },

    farShoulder: { x: 170, y: 132 },
    farElbow: { x: 172, y: 158 },
    farWrist: { x: 174, y: 188 },

    nearHip: { x: 110, y: 140 },
    nearKnee: { x: 110, y: 188 },
    nearAnkle: { x: 72, y: 188 },

    farHip: { x: 102, y: 138 },
    farKnee: { x: 102, y: 188 },
    farAnkle: { x: 64, y: 188 },
  },
  folded: {
    pelvis: { x: 80, y: 175 },     // hips sunk back onto heels
    midSpine: { x: 118, y: 174 },
    chest: { x: 155, y: 176 },
    neck: { x: 172, y: 176 },
    head: { x: 185, y: 180 },     // forehead resting on floor
    headRadius: 10,

    nearShoulder: { x: 155, y: 176 },
    nearElbow: { x: 192, y: 182 },
    nearWrist: { x: 230, y: 187 }, // arms extended forward

    farShoulder: { x: 148, y: 174 },
    farElbow: { x: 185, y: 180 },
    farWrist: { x: 222, y: 187 },

    nearHip: { x: 80, y: 175 },
    nearKnee: { x: 110, y: 188 },
    nearAnkle: { x: 72, y: 188 },

    farHip: { x: 74, y: 173 },
    farKnee: { x: 104, y: 188 },
    farAnkle: { x: 66, y: 188 },
  },
};

/**
 * Kneeling Hip Flexor Stretch preset:
 * Upright: Half-kneeling 90/90 stance.
 * Shifted: Pelvis shifts gently forward, extending the rear hip flexor while torso stays tall.
 */
export const PRESET_KNEELING_HIP_FLEXOR: { start: SkeletonPose; stretch: SkeletonPose } = {
  start: {
    pelvis: { x: 115, y: 140 },
    midSpine: { x: 115, y: 108 },
    chest: { x: 116, y: 78 },
    neck: { x: 117, y: 56 },
    head: { x: 118, y: 38 },
    headRadius: 10,

    nearShoulder: { x: 116, y: 78 },
    nearElbow: { x: 140, y: 106 },
    nearWrist: { x: 165, y: 135 }, // resting on front knee

    farShoulder: { x: 110, y: 76 },
    farElbow: { x: 134, y: 104 },
    farWrist: { x: 160, y: 133 },

    // Front leg: hip -> knee bent at 90 -> foot flat on floor
    nearHip: { x: 120, y: 140 },
    nearKnee: { x: 175, y: 140 },
    nearAnkle: { x: 175, y: 188 },

    // Back leg: knee on floor, foot resting behind
    farHip: { x: 110, y: 140 },
    farKnee: { x: 92, y: 188 },
    farAnkle: { x: 58, y: 188 },
  },
  stretch: {
    pelvis: { x: 142, y: 142 },     // shifted forward into hip extension
    midSpine: { x: 140, y: 110 },
    chest: { x: 138, y: 80 },
    neck: { x: 137, y: 58 },
    head: { x: 137, y: 40 },
    headRadius: 10,

    nearShoulder: { x: 138, y: 80 },
    nearElbow: { x: 162, y: 108 },
    nearWrist: { x: 186, y: 138 },

    farShoulder: { x: 132, y: 78 },
    farElbow: { x: 156, y: 106 },
    farWrist: { x: 180, y: 136 },

    nearHip: { x: 145, y: 142 },
    nearKnee: { x: 192, y: 142 },
    nearAnkle: { x: 175, y: 188 },

    farHip: { x: 136, y: 142 },
    farKnee: { x: 92, y: 188 },
    farAnkle: { x: 58, y: 188 },
  },
};

/**
 * Basketball session / agility drills preset:
 * Athletic defensive & crossover stance bouncing ball between hands.
 */
export const PRESET_BASKETBALL: { left: SkeletonPose; right: SkeletonPose } = {
  left: {
    pelvis: { x: 140, y: 130 },
    midSpine: { x: 140, y: 104 },
    chest: { x: 140, y: 78 },
    neck: { x: 140, y: 58 },
    head: { x: 140, y: 40 },
    headRadius: 10,

    nearShoulder: { x: 148, y: 80 },
    nearElbow: { x: 170, y: 110 },
    nearWrist: { x: 185, y: 140 },

    farShoulder: { x: 132, y: 80 },
    farElbow: { x: 112, y: 108 },
    farWrist: { x: 95, y: 138 },

    nearHip: { x: 152, y: 130 },
    nearKnee: { x: 176, y: 158 },
    nearAnkle: { x: 172, y: 188 },

    farHip: { x: 128, y: 130 },
    farKnee: { x: 104, y: 158 },
    farAnkle: { x: 108, y: 188 },

    accessory: {
      type: "circle",
      center: { x: 185, y: 150 },
      radius: 9,
      colorIndex: 7, // orange
    },
  },
  right: {
    pelvis: { x: 140, y: 130 },
    midSpine: { x: 140, y: 104 },
    chest: { x: 140, y: 78 },
    neck: { x: 140, y: 58 },
    head: { x: 140, y: 40 },
    headRadius: 10,

    nearShoulder: { x: 148, y: 80 },
    nearElbow: { x: 168, y: 112 },
    nearWrist: { x: 142, y: 148 },

    farShoulder: { x: 132, y: 80 },
    farElbow: { x: 110, y: 112 },
    farWrist: { x: 92, y: 140 },

    nearHip: { x: 152, y: 130 },
    nearKnee: { x: 176, y: 158 },
    nearAnkle: { x: 172, y: 188 },

    farHip: { x: 128, y: 130 },
    farKnee: { x: 104, y: 158 },
    farAnkle: { x: 108, y: 188 },

    accessory: {
      type: "circle",
      center: { x: 95, y: 150 },
      radius: 9,
      colorIndex: 7, // orange
    },
  },
};

/**
 * Render an animated GIF for any of the built-in procedural presets.
 */
export function renderProceduralPresetGif(presetName: string): Uint8Array | null {
  const norm = presetName.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-");
  switch (norm) {
    case "cat-cow":
    case "cat-cow-stretch":
    case "marjaryasana":
      return renderKeyframeCycleGif(PRESET_CAT_COW.cow, PRESET_CAT_COW.cat);
    case "bird-dog":
    case "bird-dog-exercise":
    case "birddog":
      return renderKeyframeCycleGif(PRESET_BIRD_DOG.base, PRESET_BIRD_DOG.extended);
    case "childs-pose":
    case "child-pose":
    case "balasana":
      return renderKeyframeCycleGif(PRESET_CHILDS_POSE.upright, PRESET_CHILDS_POSE.folded);
    case "kneeling-hip-flexor":
    case "hip-flexor-stretch":
    case "kneeling-hip-flexor-stretch":
      return renderKeyframeCycleGif(
        PRESET_KNEELING_HIP_FLEXOR.start,
        PRESET_KNEELING_HIP_FLEXOR.stretch,
      );
    case "basketball":
    case "basketball-drills":
    case "basketball-session":
      return renderKeyframeCycleGif(PRESET_BASKETBALL.left, PRESET_BASKETBALL.right, {
        frameCount: 14,
        frameDelayCs: 7,
      });
    default:
      return null;
  }
}
