export interface PaperWear {
  id: string;
  edgeDepth: number;
  edgeDepthAlt: number;
  creaseOnePosition: number;
  creaseTwoPosition: number;
  creaseOneStart: number;
  creaseTwoStart: number;
  creaseOneAngle: number;
  creaseTwoAngle: number;
  bottomCreasePosition: number;
  nickOnePosition: number;
  nickTwoPosition: number;
  opacity: number;
}

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

export function getPaperWear(number: number): PaperWear {
  if (!Number.isInteger(number) || number < 1 || number > 85) {
    throw new RangeError('Paper number must be an integer from 1 through 85.');
  }

  const random = mulberry32(number * 2_654_435_761);
  const salt = Math.floor(random() * 16_777_215).toString(36).padStart(5, '0');

  return {
    id: `paper-${number}-${salt}`,
    edgeDepth: between(random, 0.15, 0.85),
    edgeDepthAlt: between(random, 0.15, 0.85),
    creaseOnePosition: between(random, 1.5, 7.5),
    creaseTwoPosition: between(random, 92.5, 98.5),
    creaseOneStart: between(random, 7, 58),
    creaseTwoStart: between(random, 18, 71),
    creaseOneAngle: between(random, -8, 8),
    creaseTwoAngle: between(random, -8, 8),
    bottomCreasePosition: between(random, 92.5, 98.5),
    nickOnePosition: between(random, 12, 46),
    nickTwoPosition: between(random, 54, 88),
    opacity: between(random, 0.14, 0.32)
  };
}
