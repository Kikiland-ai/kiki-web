// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {PhysicalExperiment} from './PhysicalLab';
import {PhysicalPack,PhysicalSession,PhysicalObservations,type PhysicalLabApi} from '../../../contracts/physical-lab';
import recorded from '../__fixtures__/physical/dsb-sc.json';
import {ServiceError} from '../../../services/types';

vi.mock('./apparatus-viewer.mjs',()=>({ApparatusViewer:class{load(){}update(){}view(){}schedule(){}destroy(){}},clampPanel:(x:number,y:number)=>[x,y],guidePosition:()=>[8,8]}));
const pack=PhysicalPack.parse(recorded.pack),states=recorded.states.map(s=>PhysicalSession.parse(s)),observations=recorded.observations.map(s=>PhysicalObservations.parse(s));
function service(){let revision=0;const api:PhysicalLabApi={sessions:vi.fn(async()=>[]),create:vi.fn(async()=>states[0]),get:vi.fn(async()=>states[revision]),pack:vi.fn(async()=>pack),asset:vi.fn(async()=>({})),observations:vi.fn(async()=>observations[revision]),event:vi.fn(async(_id,event)=>{expect(event.revision).toBe(revision);const expected=recorded.actions[revision];expect(event).toMatchObject(expected);return states[++revision];})};return api;}
const open=(api:PhysicalLabApi,extra:Partial<Parameters<typeof PhysicalExperiment>[0]>={})=>render(<MemoryRouter><PhysicalExperiment api={api} language="en" sessionId={states[0].session_id} onSession={()=>{}} {...extra}/></MemoryRouter>);
const part=(name:string)=>screen.getByRole('button',{name:name+' on instrument'});
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('physical experiment in the KiKi Lab UI',()=>{
 it('creates an explicit demo without prerequisite clicks',async()=>{const api=service(),onSession=vi.fn();open(api,{sessionId:undefined,onSession});fireEvent.click(screen.getByRole('button',{name:'Start experiment'}));await waitFor(()=>expect(onSession).toHaveBeenCalledWith(states[0].session_id));expect(api.create).toHaveBeenCalledWith('dsb-sc-trainer','en',expect.any(String),expect.any(AbortSignal));});
 it('keeps names in the guide and numbered names only on apparatus hover/focus',async()=>{const api=service();open(api);const guide=await screen.findByRole('complementary',{name:'KiKi experiment guide'});expect(within(guide).getByText('Message output')).toBeTruthy();expect(guide.textContent).not.toMatch(/#1|#3/);fireEvent.focus(part('Message output'));expect(screen.getByRole('tooltip').textContent).toContain('#1 Message output');expect(api.event).not.toHaveBeenCalled();fireEvent.click(part('Message output'));expect(screen.getByRole('tooltip').textContent).toContain('Selected. Now click #3 Message input.');});
 it('conducts all nine recorded backend steps and shows actual returned outputs',async()=>{const api=service();open(api);await screen.findByRole('complementary',{name:'KiKi experiment guide'});
   for(let i=0;i<recorded.actions.length;i++){const action=recorded.actions[i];await screen.findByText(`STEP ${i+1} OF 9`);if(action.kind==='connect'){fireEvent.click(part(pack.parts.find(p=>p.id===action.target)!.label));fireEvent.click(part(pack.parts.find(p=>p.id===action.other)!.label));}else if(action.kind==='set'){fireEvent.change(screen.getByLabelText('Carrier null adjustment'),{target:{value:String(action.value)}});fireEvent.click(screen.getByRole('button',{name:'Apply setting'}));}else{fireEvent.change(screen.getByLabelText(/Observed value/),{target:{value:String(action.value)}});fireEvent.click(screen.getByRole('button',{name:'Record reading'}));}}
   await screen.findByText('EXPERIMENT COMPLETE');expect(api.event).toHaveBeenCalledTimes(9);const outputs=screen.getByRole('region',{name:'Live virtual outputs'});expect(outputs.textContent).toContain('1000 Hz');expect(outputs.textContent).toContain('0.5 V');
 });
 it('retries a lost response with the exact original event body',async()=>{const api=service();vi.mocked(api.event).mockRejectedValueOnce(new ServiceError('Connection interrupted'));open(api);await screen.findByRole('complementary',{name:'KiKi experiment guide'});fireEvent.click(part('Message output'));fireEvent.click(part('Message input'));fireEvent.click(await screen.findByRole('button',{name:'Retry last action'}));await screen.findByText('STEP 2 OF 9');expect(vi.mocked(api.event).mock.calls[0][1]).toEqual(vi.mocked(api.event).mock.calls[1][1]);});
 it('loads the pinned pack instead of assuming the latest apparatus',async()=>{const api=service();open(api);await screen.findByRole('complementary',{name:'KiKi experiment guide'});expect(api.pack).toHaveBeenCalledWith(states[0].session_id,expect.any(AbortSignal));expect(api.asset).toHaveBeenCalledWith(pack,expect.any(AbortSignal));});
 it('rejects a pack mismatch before rendering the apparatus',async()=>{const api=service();vi.mocked(api.pack).mockResolvedValue({...pack,version:'wrong'});open(api);await screen.findByRole('alert');expect(api.asset).not.toHaveBeenCalled();expect(screen.queryByRole('complementary',{name:'KiKi experiment guide'})).toBeNull();});
});
