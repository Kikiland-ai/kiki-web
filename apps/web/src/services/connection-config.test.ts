import { describe, expect, it } from 'vitest';
import { connectionConfig } from './connection-config';
const env = { VITE_FIREBASE_API_KEY:'synthetic-public-key', VITE_FIREBASE_AUTH_DOMAIN:'test.firebaseapp.com', VITE_FIREBASE_PROJECT_ID:'test-project', VITE_FIREBASE_APP_ID:'synthetic-app', VITE_API_BASE_URL:'http://127.0.0.1:8000/' };
describe('connected configuration', () => {
  it('accepts real local-development settings and rejects masked keys or a URL-shaped authDomain', () => {
    expect(connectionConfig(env,true).apiBaseUrl).toBe('http://127.0.0.1:8000');
    expect(()=>connectionConfig({...env,VITE_FIREBASE_API_KEY:'************'},true)).toThrow('VITE_FIREBASE_API_KEY');
    expect(()=>connectionConfig({...env,VITE_FIREBASE_AUTH_DOMAIN:'https://test.firebaseapp.com'},true)).toThrow('hostname');
  });
  it('keeps emulator identity separate and requires production HTTPS without embedded credentials', () => {
    expect(()=>connectionConfig({...env,VITE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099'},true)).toThrow('demo-kiki-local');
    const emulator={...env,VITE_FIREBASE_PROJECT_ID:'demo-kiki-local',VITE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099'};
    expect(connectionConfig(emulator,true).emulatorUrl).toBe('http://127.0.0.1:9099');
    expect(()=>connectionConfig(emulator,false)).toThrow();
    expect(()=>connectionConfig(env,false)).toThrow('HTTPS');
    expect(()=>connectionConfig({...env,VITE_API_BASE_URL:'https://user:pass@example.com'},true)).toThrow('credentials');
  });
});
