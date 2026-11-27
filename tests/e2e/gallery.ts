import {loadContent} from '../../src/content';
const root=document.querySelector<HTMLElement>('#gallery')!;
const status=document.querySelector<HTMLElement>('#status')!;
const config=loadContent();
const filter=new URLSearchParams(location.search).get('tier');
const towers=[...config.towers].sort((a,b)=>a.id.localeCompare(b.id));
const seen=new Set<string>();
const asset=(url:string)=>url.replace(/^\/?public\//,'/').replace(/^art\//,'/art/');
for(const tower of towers){
  const section=document.createElement('section'),heading=document.createElement('h2'),grid=document.createElement('div');
  heading.textContent=tower.id;grid.className='grid';
  for(const [p,path] of tower.paths.entries())for(const upgrade of path.upgrades){
    if(filter&&String(upgrade.tier)!==filter)continue;
    const key=tower.id+'-'+p+'-'+upgrade.tier;
    if(seen.has(key))throw new Error('Duplicate upgrade '+key);
    seen.add(key);
    const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');
    figure.dataset.upgrade=key;img.src=asset(upgrade.visual.asset);img.alt=upgrade.name;
    caption.textContent=key;figure.append(img,caption);grid.append(figure);
  }
  section.append(heading,grid);root.append(section);
}
status.textContent=String(seen.size);
status.dataset.ready='true';
