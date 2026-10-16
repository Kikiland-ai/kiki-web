/* Run under an environment with tsc on PATH; no generated files remain in the repository. */
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'), tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kiki-case-types-'));
try {
  const L=JSON.parse(fs.readFileSync(path.join(root,'ledgers/electronics/analog-modulation.json')));
  const C=JSON.parse(fs.readFileSync(path.join(root,'cases/analog-modulation-odia.json')));
  const file=path.join(tmp,'check.ts');
  fs.writeFileSync(file,
    'import type { Ledger } from '+JSON.stringify(path.join(root,'types/content'))+';\n'+
    'import type { LearningCase } from '+JSON.stringify(path.join(root,'types/learning-case'))+';\n'+
    'const ledger = '+JSON.stringify(L)+' satisfies Ledger;\n'+
    'const learningCase = '+JSON.stringify(C)+' satisfies LearningCase;\n');
  const r=spawnSync('tsc',['--strict','--noEmit','--target','ES2022','--module','commonjs',file],{encoding:'utf8'});
  if(r.error) throw r.error;
  process.stdout.write(r.stdout); process.stderr.write(r.stderr);
  process.exitCode=r.status;
  if(r.status===0) console.log('Ledger and learning case satisfy the strict TypeScript contracts.');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
