import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.tsx';

describe('App', () => {
  beforeEach(() => {
    // Sin backend real en este test: /auth/refresh debe fallar "limpio" (sin sesión),
    // no pegarle a la red de verdad.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable in test')));
  });

  it('redirects an unauthenticated visitor to the login page', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy();
  });
});
