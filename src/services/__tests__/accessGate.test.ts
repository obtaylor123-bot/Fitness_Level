import { MINIMUM_AGE } from '../../config/business';
import { canStartAuthentication } from '../accessGate';

describe('age and consent gate', () => {
  it('uses one minimum-age constant and blocks auth until both acknowledgements exist', () => {
    expect(MINIMUM_AGE).toBe(13);
    expect(canStartAuthentication(false, false)).toBe(false);
    expect(canStartAuthentication(true, false)).toBe(false);
    expect(canStartAuthentication(false, true)).toBe(false);
    expect(canStartAuthentication(true, true)).toBe(true);
  });
});
