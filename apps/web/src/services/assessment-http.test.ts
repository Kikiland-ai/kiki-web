import { describe, expect, it, vi } from 'vitest';
import { createAssessmentApi } from './assessment-http';
import type { AuthService } from '../contracts/services';
const auth = {getIdToken: async () => 'synthetic-test-token'} as AuthService;
describe('connected assessment transport', () => {
  it('sends stable operation keys and only choice data, never a client score', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('',{status:503}));
    const api = createAssessmentApi('http://localhost/v1',auth,fetcher);
    const payload = {responses:[{questionId:'Q-AM-01-1',optionIndex:2}]};
    await expect(api.submit('run-1',payload,undefined,'submit-one')).rejects.toThrow('could not be saved');
    await expect(api.submit('run-1',payload,undefined,'submit-one')).rejects.toThrow('could not be saved');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const request = fetcher.mock.calls[0][1]!;
    expect(request.headers).toEqual({Authorization:'Bearer synthetic-test-token','Content-Type':'application/json','Idempotency-Key':'submit-one'});
    expect(JSON.parse(request.body as string)).toEqual(payload);
  });
  it('rejects malformed results and does not bypass a prerequisite or ownership denial', async () => {
    await expect(createAssessmentApi('http://localhost',auth,async () => new Response('{"result":{"passed":true}}')).getResult('run-1')).rejects.toThrow('unsupported');
    await expect(createAssessmentApi('http://localhost',auth,async () => new Response('',{status:409})).start('AS-AM-CHAPTER')).rejects.toThrow('prerequisites');
    await expect(createAssessmentApi('http://localhost',auth,async () => new Response('',{status:403})).get('other')).rejects.toThrow('do not have access');
  });
});
