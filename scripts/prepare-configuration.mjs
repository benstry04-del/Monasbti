import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';

export async function prepareConfiguration(root=process.cwd()) {
  const template=await readFile(resolve(root,'.env.example'),'utf8');
  const env=template
    .replace(/^COOKIE_SECRET=.*$/m,'COOKIE_SECRET='+randomBytes(48).toString('hex'))
    .replace(/^ENCRYPTION_KEY=.*$/m,'ENCRYPTION_KEY='+randomBytes(32).toString('hex'))
    .replace(/^METRICS_TOKEN=.*$/m,'METRICS_TOKEN='+randomBytes(32).toString('hex'));
  const outcomes=[];
  for (const [relative,contents] of [
    ['.env',env],
    ['data/business-settings.json',await readFile(resolve(root,'config/business.example.json'),'utf8')],
  ]) {
    const path=resolve(root,relative);
    await mkdir(dirname(path),{recursive:true});
    try {
      await writeFile(path,contents,{flag:'wx',mode:0o600});
      await chmod(path,0o600).catch(()=>{});
      outcomes.push({file:relative,status:'created'});
    } catch(error) {
      if(error.code!=='EEXIST')throw error;
      outcomes.push({file:relative,status:'preserved'});
    }
  }
  return outcomes;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify({configuration:await prepareConfiguration(),next:'docs/production/CONFIGURATION-ENTRY.md'}));
