export interface PaperFold {
  path: string;
  highlightOffsetX: number;
  highlightOffsetY: number;
  opacity: number;
  hazeWidth: number;
  lineWidth: number;
}

export interface PaperAbrasion {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  opacity: number;
}

export interface PaperStain {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  opacity: number;
}

export interface PaperCornerFold {
  location: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  areaPath: string;
  creasePath: string;
  opacity: number;
}

export interface PaperWear {
  id: string;
  foldSignature: string;
  grainSeed: number;
  grainFrequency: number;
  opacity: number;
  edgeOpacity: number;
  folds: PaperFold[];
  abrasions: PaperAbrasion[];
  stains: PaperStain[];
  cornerFold: PaperCornerFold;
}

interface Point {
  x: number;
  y: number;
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

function point(x: number, y: number): Point {
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}

function mirrorHorizontally(points: Point[]): Point[] {
  return points.map(({ x, y }) => point(100 - x, y));
}

function pathFrom(points: [Point, Point, Point, Point]): string {
  const [start, controlOne, controlTwo, end] = points;
  return `M ${start.x} ${start.y} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${end.x} ${end.y}`;
}

function createFold(random: () => number, points: [Point, Point, Point, Point]): PaperFold {
  const horizontal = Math.abs(points[3].x - points[0].x) >= Math.abs(points[3].y - points[0].y);

  return {
    path: pathFrom(points),
    highlightOffsetX: horizontal ? between(random, -0.08, 0.08) : between(random, 0.09, 0.18),
    highlightOffsetY: horizontal ? between(random, 0.035, 0.075) : between(random, -0.03, 0.03),
    opacity: between(random, 0.12, 0.3),
    hazeWidth: between(random, 12, 24),
    lineWidth: between(random, 0.8, 1.65)
  };
}

function createFolds(random: () => number): PaperFold[] {
  const topY = between(random, 5, 16);
  const topEndX = between(random, 20, 43);
  let top: [Point, Point, Point, Point] = [
    point(0, topY),
    point(between(random, 4, 10), topY * between(random, 0.58, 0.84)),
    point(topEndX * between(random, 0.58, 0.82), between(random, 0.4, 2.8)),
    point(topEndX, 0)
  ];
  if (random() > 0.5) top = mirrorHorizontally(top) as [Point, Point, Point, Point];

  const bottomStartY = between(random, 82, 94);
  const bottomEndX = between(random, 18, 46);
  let bottom: [Point, Point, Point, Point] = [
    point(0, bottomStartY),
    point(between(random, 3, 9), between(random, bottomStartY + 1, 96)),
    point(bottomEndX * between(random, 0.55, 0.82), between(random, 97.2, 99.5)),
    point(bottomEndX, 100)
  ];
  if (random() > 0.5) bottom = mirrorHorizontally(bottom) as [Point, Point, Point, Point];

  const sideStartY = between(random, 28, 60);
  const sideEndY = Math.min(92, sideStartY + between(random, 17, 31));
  let side: [Point, Point, Point, Point] = [
    point(0, sideStartY),
    point(between(random, 2.5, 7), sideStartY + between(random, 2, 7)),
    point(between(random, 2, 8), sideEndY - between(random, 2, 7)),
    point(0, sideEndY)
  ];
  if (random() > 0.5) side = mirrorHorizontally(side) as [Point, Point, Point, Point];

  return [createFold(random, top), createFold(random, bottom), createFold(random, side)];
}

function createAbrasions(random: () => number): PaperAbrasion[] {
  return Array.from({ length: 6 }, () => {
    const side = Math.floor(random() * 4);
    const vertical = side < 2;
    const x = vertical
      ? side === 0
        ? between(random, 0.2, 3.2)
        : between(random, 96.8, 99.8)
      : between(random, 7, 93);
    const y = vertical
      ? between(random, 7, 93)
      : side === 2
        ? between(random, 0.15, 2.35)
        : between(random, 97.65, 99.85);

    return {
      x,
      y,
      radiusX: vertical ? between(random, 0.08, 0.28) : between(random, 0.16, 0.72),
      radiusY: vertical ? between(random, 0.16, 0.72) : between(random, 0.05, 0.2),
      rotation: between(random, -28, 28),
      opacity: between(random, 0.08, 0.18)
    };
  });
}

function createStains(random: () => number): PaperStain[] {
  return Array.from({ length: 3 }, (_, index) => ({
    x: index === 0 ? between(random, 3, 15) : index === 1 ? between(random, 84, 97) : between(random, 16, 84),
    y: between(random, 5, 95),
    radiusX: between(random, 3.5, 10),
    radiusY: between(random, 0.55, 1.9),
    rotation: between(random, -38, 38),
    opacity: between(random, 0.025, 0.065)
  }));
}

function createCornerFold(random: () => number): PaperCornerFold {
  const locations = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
  const location = locations[Math.floor(random() * locations.length)];
  const width = between(random, 3.5, 8.5);
  const height = between(random, 1.2, 3.4);
  const top = location.startsWith('top');
  const left = location.endsWith('left');
  const cornerX = left ? 0 : 100;
  const cornerY = top ? 0 : 100;
  const edgeX = left ? width : 100 - width;
  const edgeY = top ? height : 100 - height;
  const areaPath = `M ${cornerX} ${cornerY} L ${edgeX} ${cornerY} L ${cornerX} ${edgeY} Z`;
  const creasePath = `M ${edgeX} ${cornerY} Q ${left ? width * 0.44 : 100 - width * 0.44} ${
    top ? height * 0.54 : 100 - height * 0.54
  }, ${cornerX} ${edgeY}`;

  return {
    location,
    areaPath,
    creasePath,
    opacity: between(random, 0.28, 0.48)
  };
}

export function getPaperWear(number: number): PaperWear {
  if (!Number.isInteger(number) || number < 1 || number > 85) {
    throw new RangeError('Paper number must be an integer from 1 through 85.');
  }

  const random = mulberry32(number * 2_654_435_761);
  const salt = Math.floor(random() * 16_777_215).toString(36).padStart(5, '0');
  const folds = createFolds(random);

  return {
    id: `paper-${number}-${salt}`,
    foldSignature: folds.map(({ path }) => path).join('|'),
    grainSeed: Math.floor(between(random, 1, 999)),
    grainFrequency: between(random, 0.58, 0.82),
    opacity: between(random, 0.42, 0.7),
    edgeOpacity: between(random, 0.12, 0.22),
    folds,
    abrasions: createAbrasions(random),
    stains: createStains(random),
    cornerFold: createCornerFold(random)
  };
}
