import {describe,it,expect,vi} from 'vitest';
import {createPhysicalLabApi} from './physical-lab-http';
import type {AuthService} from '../contracts/services';
import recorded from '../features/labs/__fixtures__/physical/dsb-sc.json';
const auth={getIdToken:vi.fn(async()=> 'verified-token')} as unknown as AuthService;
describe('physical lab adapter',()=>{
 it('uses the current API and explicit demo mode with a repeatable creation key',async()=>{const fetcher=vi.fn(async()=>new Response(JSON.stringify(recorded.states[0]),{status:201}));const api=createPhysicalLabApi('https://kiki.example',auth,fetcher);await api.create('dsb-sc-trainer','en','same-create');expect(fetcher.mock.calls[0]).toEqual(['https://kiki.example/physical-labs/sessions',expect.objectContaining({method:'POST',headers:expect.objectContaining({Authorization:'Bearer verified-token','Idempotency-Key':'same-create'}),body:JSON.stringify({experiment_id:'dsb-sc-trainer',language:'en',mode:'experiment_demo'})})]);});
 it('preserves revision conflicts and does not silently rebase',async()=>{const fetcher=vi.fn(async()=>new Response('{}',{status:409}));const api=createPhysicalLabApi('https://kiki.example',auth,fetcher);await expect(api.event(recorded.states[0].session_id,{event_id:'one',revision:0,kind:'connect',target:'source.message',other:'modulator.message'})).rejects.toMatchObject({status:409});expect(fetcher).toHaveBeenCalledTimes(1);});
 it('rejects unsupported response/session identities',async()=>{const fetcher=vi.fn(async()=>new Response(JSON.stringify({...recorded.states[0],session_id:'b'.repeat(32)})));const api=createPhysicalLabApi('https://kiki.example',auth,fetcher);await expect(api.get(recorded.states[0].session_id)).rejects.toThrow('another session');});
});
