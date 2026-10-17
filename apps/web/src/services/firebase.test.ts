import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk=vi.hoisted(()=>({auth:{currentUser:null as null | {getIdToken:ReturnType<typeof vi.fn>}},initializeApp:vi.fn(),connectAuthEmulator:vi.fn(),getRedirectResult:vi.fn(),onAuthStateChanged:vi.fn(),setPersistence:vi.fn(),signInWithPopup:vi.fn(),signInWithRedirect:vi.fn(),signOut:vi.fn(),parameters:vi.fn()}));
vi.mock('firebase/app',()=>({initializeApp:sdk.initializeApp}));
vi.mock('firebase/auth',()=>({getAuth:()=>sdk.auth,connectAuthEmulator:sdk.connectAuthEmulator,getRedirectResult:sdk.getRedirectResult,onAuthStateChanged:sdk.onAuthStateChanged,setPersistence:sdk.setPersistence,signInWithPopup:sdk.signInWithPopup,signInWithRedirect:sdk.signInWithRedirect,signOut:sdk.signOut,browserLocalPersistence:'local',browserSessionPersistence:'session',GoogleAuthProvider:class {setCustomParameters=sdk.parameters}}));
import { createFirebaseAuth } from './firebase';
import type { ConnectionConfig } from './connection-config';
const config:ConnectionConfig={firebase:{apiKey:'synthetic-public-key',authDomain:'test.firebaseapp.com',projectId:'test-project',appId:'synthetic-app'},apiBaseUrl:'http://127.0.0.1:8000'};
beforeEach(()=>{vi.clearAllMocks();sdk.auth.currentUser=null;sdk.getRedirectResult.mockResolvedValue(null);});
describe('Firebase Google auth adapter (SDK mocked)',()=>{
  it('uses Google account selection, session persistence by default, then opens a popup',async()=>{
    const auth=await createFirebaseAuth(config);
    await auth.signIn({remember:false,redirect:false});
    expect(sdk.initializeApp).toHaveBeenCalledWith(config.firebase);expect(sdk.parameters).toHaveBeenCalledWith({prompt:'select_account'});
    expect(sdk.setPersistence).toHaveBeenCalledWith(sdk.auth,'session');expect(sdk.signInWithPopup).toHaveBeenCalledOnce();expect(sdk.signInWithRedirect).not.toHaveBeenCalled();
    expect(sdk.setPersistence.mock.invocationCallOrder[0]).toBeLessThan(sdk.signInWithPopup.mock.invocationCallOrder[0]);
  });
  it('remembers a personal-device session only when selected and handles explicit redirect',async()=>{
    const auth=await createFirebaseAuth(config);await auth.signIn({remember:true,redirect:true});
    expect(sdk.setPersistence).toHaveBeenCalledWith(sdk.auth,'local');expect(sdk.signInWithRedirect).toHaveBeenCalledOnce();expect(sdk.signInWithPopup).not.toHaveBeenCalled();
  });
  it('reports redirect failures without treating them as a successful signed-out result',async()=>{
    const error={code:'auth/unauthorized-domain'};sdk.getRedirectResult.mockRejectedValueOnce(error);
    const auth=await createFirebaseAuth(config),listener=vi.fn(),onError=vi.fn();auth.subscribe(listener,onError);
    sdk.onAuthStateChanged.mock.calls[0][1](null);expect(onError).toHaveBeenCalledWith(error);expect(listener).not.toHaveBeenCalled();
    sdk.onAuthStateChanged.mock.calls[0][1](null);expect(listener).toHaveBeenCalledWith(null);
  });
  it('requires identity for tokens and connects the emulator before redirect restoration',async()=>{
    const auth=await createFirebaseAuth({...config,emulatorUrl:'http://127.0.0.1:9099'});
    expect(sdk.connectAuthEmulator.mock.invocationCallOrder[0]).toBeLessThan(sdk.getRedirectResult.mock.invocationCallOrder[0]);
    await expect(auth.getIdToken()).rejects.toThrow('Please sign in');
    const getIdToken=vi.fn().mockResolvedValue('synthetic-token');sdk.auth.currentUser={getIdToken};expect(await auth.getIdToken(true)).toBe('synthetic-token');expect(getIdToken).toHaveBeenCalledWith(true);
    await auth.signOut();expect(sdk.signOut).toHaveBeenCalledWith(sdk.auth);
  });
});
