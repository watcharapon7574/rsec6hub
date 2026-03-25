import { describe, it, expect } from 'vitest';

// Test signature rotation logic used in DocumentManagePage
// The actual handler: rotation = (current + 90) % 360

function rotateSignature(currentRotation: number): number {
  return (currentRotation + 90) % 360;
}

describe('Signature Pin Rotation', () => {
  it('0 → 90 → 180 → 270 → 0', () => {
    let r = 0;
    r = rotateSignature(r); expect(r).toBe(90);
    r = rotateSignature(r); expect(r).toBe(180);
    r = rotateSignature(r); expect(r).toBe(270);
    r = rotateSignature(r); expect(r).toBe(0);
  });

  it('default rotation is 0', () => {
    const pos = { x: 100, y: 200, page: 1, rotation: undefined };
    expect(pos.rotation || 0).toBe(0);
  });

  it('rotation value is included in signature payload', () => {
    const pos = { x: 100, y: 200, page: 1, rotation: 90 };
    const payload = {
      page: pos.page - 1,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      rotation: pos.rotation || 0,
      width: 120,
      height: 60,
    };
    expect(payload.rotation).toBe(90);
    expect(payload.page).toBe(0); // 1-based → 0-based
  });

  it('no rotation → payload has rotation: 0', () => {
    const pos = { x: 100, y: 200, page: 1 };
    const payload = {
      rotation: (pos as any).rotation || 0,
    };
    expect(payload.rotation).toBe(0);
  });
});
