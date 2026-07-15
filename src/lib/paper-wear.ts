export type PaperEdgeSide = 'top' | 'right' | 'bottom' | 'left';
export type PaperCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PaperEdge {
  side: PaperEdgeSide;
  /** Length of one seamless deckle tile along the edge, in px. */
  tileLength: number;
  /** Strip thickness in px; every sampled depth stays inside it. */
  depth: number;
  /** Sampled intrusion depths in px; first and last match so tiles repeat seamlessly. */
  depths: number[];
  /** Closed tile path in px units, oriented for its side, filled where the room shows. */
  path: string;
}

export interface PaperNick {
  side: PaperEdgeSide;
  /** Position along the edge as a percentage, kept away from the corners. */
  offset: number;
  width: number;
  depth: number;
  /** Closed bite path in px units, oriented for its side. */
  path: string;
}

export interface PaperCornerFold {
  corner: PaperCorner;
  /** Side length of the fixed corner block in px. */
  size: number;
  liftAlpha: number;
  contactAlpha: number;
  rimAlpha: number;
}

export interface PaperCornerChip {
  corner: PaperCorner;
  size: number;
  /** Closed chamfer path in px units, oriented for its corner. */
  path: string;
}

export interface PaperToning {
  /** How far each deckle/nick mask is stretched to expose a browned fringe. */
  scale: number;
  /** Opacity of the sepia fringe layer; kept very slight. */
  alpha: number;
}

export interface PaperWear {
  signature: string;
  edges: PaperEdge[];
  nicks: PaperNick[];
  /** Roughly two of three papers earn a lifted corner; the rest stay flat. */
  cornerFold: PaperCornerFold | null;
  cornerSofteners: PaperCornerChip[];
  toning: PaperToning;
}

const EDGE_SIDES: PaperEdgeSide[] = ['top', 'right', 'bottom', 'left'];
const CORNERS: PaperCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function between(random: () => number, minimum: number, maximum: number): number {
  return Number((minimum + random() * (maximum - minimum)).toFixed(3));
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Sample a seamless deckle boundary: two seeded sine waves (integer cycle
 * counts keep the tile periodic) plus per-point jitter, clamped shallow.
 */
function createDepths(random: () => number, mean: number, ceiling: number): number[] {
  const samples = 28 + Math.floor(random() * 17);
  const amplitudeOne = between(random, 0.5, 1.1);
  const amplitudeTwo = between(random, 0.3, 0.75);
  const cyclesOne = 2 + Math.floor(random() * 2);
  const cyclesTwo = 5 + Math.floor(random() * 3);
  const phaseOne = between(random, 0, Math.PI * 2);
  const phaseTwo = between(random, 0, Math.PI * 2);
  const jitter = between(random, 0.2, 0.55);

  const depths = Array.from({ length: samples }, (_, index) => {
    const t = (index / samples) * Math.PI * 2;
    const wave =
      mean +
      amplitudeOne * Math.sin(cyclesOne * t + phaseOne) +
      amplitudeTwo * Math.sin(cyclesTwo * t + phaseTwo) +
      between(random, -jitter, jitter);
    return round(Math.min(ceiling - 0.3, Math.max(0.35, wave)));
  });
  depths.push(depths[0]);
  return depths;
}

function createEdge(random: () => number, side: PaperEdgeSide): PaperEdge {
  const mean = between(random, 1.7, 3.2);
  const depth = Math.ceil(mean + 2.2);
  const depths = createDepths(random, mean, depth);
  const segments = depths.length - 1;
  const step = between(random, 340, 520) / segments;
  const tileLength = round(step * segments);
  const along = (index: number) => round(index * step);

  let points: string[];
  switch (side) {
    case 'top':
      points = depths.map((d, i) => `L ${along(i)} ${d}`).reverse();
      points.unshift(`M 0 0 L ${tileLength} 0`);
      break;
    case 'bottom':
      points = depths.map((d, i) => `L ${along(i)} ${round(depth - d)}`).reverse();
      points.unshift(`M 0 ${depth} L ${tileLength} ${depth}`);
      break;
    case 'left':
      points = depths.map((d, i) => `L ${d} ${along(i)}`).reverse();
      points.unshift(`M 0 0 L 0 ${tileLength}`);
      break;
    case 'right':
      points = depths.map((d, i) => `L ${round(depth - d)} ${along(i)}`).reverse();
      points.unshift(`M ${depth} 0 L ${depth} ${tileLength}`);
      break;
  }

  return { side, tileLength, depth, depths, path: `${points.join(' ')} Z` };
}

function createNick(random: () => number, side: PaperEdgeSide): PaperNick {
  const offset = between(random, 8, 92);
  const width = between(random, 18, 44);
  const depth = between(random, 4, 9);
  const apex = round(width * between(random, 0.38, 0.62));
  const shoulderIn = round(width * 0.26);
  const shoulderOut = round(width * 0.74);

  const bite = (
    start: string,
    end: string,
    controlIn: string,
    apexPoint: string,
    controlOut: string
  ) => `M ${start} Q ${controlIn}, ${apexPoint} Q ${controlOut}, ${end} Z`;

  let path: string;
  switch (side) {
    case 'top':
      path = bite(`0 0`, `${width} 0`, `${shoulderIn} ${round(depth * 0.78)}`, `${apex} ${depth}`, `${shoulderOut} ${round(depth * 0.66)}`);
      break;
    case 'bottom':
      path = bite(`0 ${depth}`, `${width} ${depth}`, `${shoulderIn} ${round(depth * 0.22)}`, `${apex} 0`, `${shoulderOut} ${round(depth * 0.34)}`);
      break;
    case 'left':
      path = bite(`0 0`, `0 ${width}`, `${round(depth * 0.78)} ${shoulderIn}`, `${depth} ${apex}`, `${round(depth * 0.66)} ${shoulderOut}`);
      break;
    case 'right':
      path = bite(`${depth} 0`, `${depth} ${width}`, `${round(depth * 0.22)} ${shoulderIn}`, `0 ${apex}`, `${round(depth * 0.34)} ${shoulderOut}`);
      break;
  }

  return { side, offset, width, depth, path };
}

function createNicks(random: () => number): PaperNick[] {
  const count = 2 + Math.floor(random() * 3);
  const sides = [...EDGE_SIDES];
  for (let index = sides.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [sides[index], sides[swap]] = [sides[swap], sides[index]];
  }
  return sides.slice(0, count).map((side) => createNick(random, side));
}

function createCornerFold(random: () => number): PaperCornerFold | null {
  if (random() > 2 / 3) {
    return null;
  }

  // Square the spread so small, casual lifts outnumber dramatic ones.
  const spread = random();
  return {
    corner: pick(random, CORNERS),
    size: Number((48 + spread * spread * 102).toFixed(3)),
    liftAlpha: between(random, 0.12, 0.34),
    contactAlpha: between(random, 0.05, 0.12),
    rimAlpha: between(random, 0.08, 0.18)
  };
}

function createCornerChip(random: () => number, corner: PaperCorner): PaperCornerChip {
  const size = between(random, 6, 14);
  const c = round(size);
  const inner = round(size * between(random, 0.32, 0.5));

  let path: string;
  switch (corner) {
    case 'top-left':
      path = `M ${c} 0 L 0 0 L 0 ${c} Q ${inner} ${inner}, ${c} 0 Z`;
      break;
    case 'top-right':
      path = `M 0 0 L ${c} 0 L ${c} ${c} Q ${round(c - inner)} ${inner}, 0 0 Z`;
      break;
    case 'bottom-left':
      path = `M 0 0 L 0 ${c} L ${c} ${c} Q ${inner} ${round(c - inner)}, 0 0 Z`;
      break;
    case 'bottom-right':
      path = `M ${c} 0 L ${c} ${c} L 0 ${c} Q ${round(c - inner)} ${round(c - inner)}, ${c} 0 Z`;
      break;
  }

  return { corner, size, path };
}

function createCornerSofteners(
  random: () => number,
  foldCorner: PaperCorner | null
): PaperCornerChip[] {
  const candidates = CORNERS.filter((corner) => corner !== foldCorner);
  const count = 2 + Math.floor(random() * 2);
  const chosen = [...candidates];
  for (let index = chosen.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [chosen[index], chosen[swap]] = [chosen[swap], chosen[index]];
  }
  return chosen.slice(0, count).map((corner) => createCornerChip(random, corner));
}

function hash(value: string): string {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) {
    result = ((result << 5) + result + value.charCodeAt(index)) | 0;
  }
  return (result >>> 0).toString(36);
}

export function getPaperWear(number: number): PaperWear {
  if (!Number.isInteger(number) || number < 1 || number > 85) {
    throw new RangeError('Paper number must be an integer from 1 through 85.');
  }

  const random = mulberry32(number * 2_654_435_761);
  const edges = EDGE_SIDES.map((side) => createEdge(random, side));
  const nicks = createNicks(random);
  const cornerFold = createCornerFold(random);
  const cornerSofteners = createCornerSofteners(random, cornerFold?.corner ?? null);
  const toning: PaperToning = {
    scale: between(random, 1.45, 1.95),
    alpha: between(random, 0.1, 0.18)
  };

  return {
    signature: `${number}-${hash(edges.map((edge) => edge.path).join('|'))}`,
    edges,
    nicks,
    cornerFold,
    cornerSofteners,
    toning
  };
}
