import { describe, it, expect } from 'vitest';
import { readActionParams } from '../src/ui/AuthActionPage';

describe('auth email links', () => {
  const base = 'https://example.com/auth/action';
  it('reads a normal link', () => {
    expect(readActionParams(`${base}?mode=verifyEmail&oobCode=ABC_123-x&apiKey=k&lang=en`)).toEqual({ mode: 'verifyEmail', oobCode: 'ABC_123-x' });
  });
  it('survives &amp; from HTML-mangling mail apps', () => {
    expect(readActionParams(`${base}?mode=verifyEmail&amp;oobCode=ABC&amp;apiKey=k`)).toEqual({ mode: 'verifyEmail', oobCode: 'ABC' });
  });
  it('survives double-encoded query strings', () => {
    expect(readActionParams(`${base}?mode%3DresetPassword%26oobCode%3DXYZ`)).toEqual({ mode: 'resetPassword', oobCode: 'XYZ' });
  });
  it('finds parameters moved into the hash, and a missing mode', () => {
    expect(readActionParams(`${base}#oobCode=QQQ&apiKey=k`)).toEqual({ mode: null, oobCode: 'QQQ' });
  });
});
