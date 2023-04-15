export function getDistance(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
}

export function getD3D(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function getXDire(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
) {
  return (
    Math.asin(Math.abs(y1 - y2) / getD3D(x1, y1, z1, x2, y2, z2)) *
    (y1 > y2 ? -1 : 1)
  );
}

export function getDir(x1: number, y1: number, x2: number, y2: number) {
  return Math.atan2(y1 - y2, x1 - x2);
}

export function lineInRect(
  lx1: number,
  lz1: number,
  ly1: number,
  dx: number,
  dz: number,
  dy: number,
  x1: number,
  z1: number,
  y1: number,
  x2: number,
  z2: number,
  y2: number
) {
  const t1 = (x1 - lx1) * dx;
  const t2 = (x2 - lx1) * dx;
  const t3 = (y1 - ly1) * dy;
  const t4 = (y2 - ly1) * dy;
  const t5 = (z1 - lz1) * dz;
  const t6 = (z2 - lz1) * dz;

  const tmin = Math.max(
    Math.max(Math.min(t1, t2), Math.min(t3, t4)),
    Math.min(t5, t6)
  );

  const tmax = Math.min(
    Math.min(Math.max(t1, t2), Math.max(t3, t4)),
    Math.max(t5, t6)
  );

  return tmax < 0 || tmin > tmax ? false : tmin;
}

export function getAngleDst(a1: number, a2: number) {
  return Math.atan2(Math.sin(a2 - a1), Math.cos(a1 - a2));
}
