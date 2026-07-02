import type { GridType } from '../types/map';

// Grade hexagonal: pointy-top com offset odd-r.
// cellSize = largura do hex (sqrt(3) * s), onde s = raio centro→vértice.

export function hexRadius(cellSize: number): number {
  return cellSize / Math.sqrt(3);
}

export function cellCenter(gridType: GridType, cellSize: number, col: number, row: number): { x: number; y: number } {
  if (gridType === 'square') {
    return { x: (col + 0.5) * cellSize, y: (row + 0.5) * cellSize };
  }
  const s = hexRadius(cellSize);
  return {
    x: cellSize * (col + 0.5 * (row & 1)) + cellSize / 2,
    y: 1.5 * s * row + s,
  };
}

export function pointToCell(gridType: GridType, cellSize: number, x: number, y: number): { col: number; row: number } {
  if (gridType === 'square') {
    return { col: Math.floor(x / cellSize), row: Math.floor(y / cellSize) };
  }
  const s = hexRadius(cellSize);
  // pixel → axial fracionário → cube rounding → offset odd-r
  const px = x - cellSize / 2;
  const py = y - s;
  const qf = (Math.sqrt(3) / 3 * px - py / 3) / s;
  const rf = (2 / 3 * py) / s;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const sf = -qf - rf;
  let sc = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(sc - sf);
  if (dq > dr && dq > ds) q = -r - sc;
  else if (dr > ds) r = -q - sc;
  return { col: q + (r - (r & 1)) / 2, row: r };
}

export function cellDistance(gridType: GridType, a: { col: number; row: number }, b: { col: number; row: number }): number {
  if (gridType === 'square') {
    // Regra 5e simplificada: diagonal = 1 célula (Chebyshev)
    return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
  }
  const aq = a.col - (a.row - (a.row & 1)) / 2;
  const bq = b.col - (b.row - (b.row & 1)) / 2;
  const dq = aq - bq;
  const dr = a.row - b.row;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function gridDims(gridType: GridType, cellSize: number, width: number, height: number): { cols: number; rows: number } {
  if (gridType === 'square') {
    return { cols: Math.ceil(width / cellSize), rows: Math.ceil(height / cellSize) };
  }
  const s = hexRadius(cellSize);
  return { cols: Math.ceil(width / cellSize), rows: Math.ceil((height - s / 2) / (1.5 * s)) + 1 };
}

// Vértices do hexágono (pointy-top) como array plano [x0,y0,x1,y1,...] relativo ao centro
export function hexCornerPoints(cellSize: number, inflate = 0): number[] {
  const s = hexRadius(cellSize) + inflate;
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(s * Math.cos(angle), s * Math.sin(angle));
  }
  return pts;
}
