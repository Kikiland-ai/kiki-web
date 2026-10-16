import { expect, it, vi } from 'vitest';
import { createLearningApi } from './learning-http';
import type { AuthService } from '../contracts/services';
const auth={getIdToken:async()=>'synthetic-unit-token'} as AuthService;
it('uses bearer-authenticated position PUT with a cancellation signal and validates the receipt',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({position:{conceptId:'C-AM-08',status:'learning',theoryCheck:{status:'not_attempted'},position:{placardId:'CARD-AM-08-concept',updatedAt:'2026-10-15T12:00:00Z'}}}));
  const api=createLearningApi('http://localhost',auth,fetcher), controller=new AbortController();
  await api.savePosition('C-AM-08','CARD-AM-08-concept',controller.signal);
  const args=fetcher.mock.calls[0]; expect(args[0]).toBe('http://localhost/learners/me/positions/C-AM-08');
  expect(args[1]).toMatchObject({method:'PUT',headers:{Authorization:'Bearer synthetic-unit-token','Content-Type':'application/json'},body:'{"placardId":"CARD-AM-08-concept"}'});
  expect(args[1]?.signal).toBeDefined();
});
it('does not replace unavailable connected content with fixtures',async()=>{
  const api=createLearningApi('http://localhost',auth,async()=>new Response('',{status:404}));
  await expect(api.getChapter('LP-ANALOG-MODULATION')).rejects.toThrow('not available from the connected service yet');
});
it('rejects malformed content and responses for another concept',async()=>{
  const api=createLearningApi('http://localhost',auth,async()=>Response.json({chapter:{planId:'foreign'}}));
  await expect(api.getChapter('LP-ANALOG-MODULATION')).rejects.toThrow('unsupported response');
  const wrong=createLearningApi('http://localhost',auth,async()=>Response.json({position:{conceptId:'C-AM-01',status:'learning',theoryCheck:{status:'not_attempted'},position:{placardId:'CARD-AM-01-concept',updatedAt:'2026-10-15T12:00:00Z'}}}));
  await expect(wrong.savePosition('C-AM-08','CARD-AM-08-concept')).rejects.toThrow('does not match');
});
