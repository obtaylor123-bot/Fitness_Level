import { canStartAuthentication } from '../accessGate';

describe('authentication acknowledgement gate', () => {
  it('requires policy acknowledgement without an age confirmation', () => {
    expect(canStartAuthentication(false)).toBe(false);
    expect(canStartAuthentication(true)).toBe(true);
  });
});
