export const MAX_REGIONS=12;
const normalize=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'");
export function labelMatches(text,dictionary){
 const normalized=normalize(text),found=[];
 for(const [term,name] of dictionary){
  const escaped=normalize(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for(const match of normalized.matchAll(new RegExp('\\b'+escaped+'\\b','g')))found.push({name,start:match.index,end:match.index+match[0].length});
 }
 const selected=[];
 for(const candidate of found.sort((a,b)=>(b.end-b.start)-(a.end-a.start)))if(!selected.some(v=>candidate.start<v.end&&candidate.end>v.start))selected.push(candidate);
 return [...new Set(selected.sort((a,b)=>a.start-b.start).map(v=>v.name))];
}
export function overlap(a,b){
 const intersection=Math.max(0,Math.min(a.xmax,b.xmax)-Math.max(a.xmin,b.xmin))*Math.max(0,Math.min(a.ymax,b.ymax)-Math.max(a.ymin,b.ymin));
 const area=v=>(v.xmax-v.xmin)*(v.ymax-v.ymin);
 return intersection/(area(a)+area(b)-intersection||1);
}
export function selectRegions(detections){
 const kept=[];
 for(const item of [...detections].sort((a,b)=>b.score-a.score)){
  if(!['bottle','wine glass','cup','orange'].includes(item.label)||item.score<0.35)continue;
  const box=Object.fromEntries(Object.entries(item.box).map(([k,v])=>[k,Math.max(0,Math.min(1,v))]));
  if(!Object.values(box).every(Number.isFinite)||box.xmax-box.xmin<0.015||box.ymax-box.ymin<0.02)continue;
  if(!kept.some(v=>overlap(v.box,box)>0.5))kept.push({...item,box});
 }
 const total=kept.length;
 return {total,regions:kept.slice(0,MAX_REGIONS).sort((a,b)=>a.box.xmin-b.box.xmin)};
}
export function cropPixels(image,box){
 const x=Math.max(0,Math.floor(box.xmin*image.width)),y=Math.max(0,Math.floor(box.ymin*image.height));
 const width=Math.max(1,Math.min(image.width-x,Math.ceil(box.xmax*image.width)-x));
 const height=Math.max(1,Math.min(image.height-y,Math.ceil(box.ymax*image.height)-y));
 const data=new Uint8ClampedArray(width*height*image.channels);
 for(let row=0;row<height;row++){
  const start=((y+row)*image.width+x)*image.channels;
  data.set(image.data.subarray(start,start+width*image.channels),row*width*image.channels);
 }
 return {data,width,height,channels:image.channels};
}
export function suggestions(read,visual,labels){
 const byName=new Map(read.filter(name=>labels.includes(name)).map(name=>[name,{name,basis:'Label text'}]));
 for(const item of visual){if(item.score<0.035||!labels.includes(item.label))continue;if(!byName.has(item.label))byName.set(item.label,{name:item.label,basis:'Visual guess'});if(byName.size>=4)break;}
 return [...byName.values()].slice(0,4);
}
