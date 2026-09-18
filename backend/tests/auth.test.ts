import { describe, expect, it } from 'vitest';
import { signToken } from '../src/middleware/auth.js';

describe('authentication token', () => {
  it('signs a token containing a role claim', () => { const token=signToken({sub:'123',email:'staff@example.com',name:'Staff',role:'librarian'}); expect(token.split('.')).toHaveLength(3); });
});
