import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
import {selectRegions,cropPixels,labelMatches,suggestions,MAX_REGIONS} from './recognition-core.mjs';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
let detector,classifier,ocr,active=false;
const status=message=>self.postMessage({status:message});
async function readLabel(image){
 const canvas=new OffscreenCanvas(image.width,image.height);
 const rgba=image.clone().rgba();
 canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.data),image.width,image.height),0,0);
 const blob=await canvas.convertToBlob({type:'image/png'});
 const result=await ocr.recognize(blob);
 return result.data.confidence>=35?result.data.text.trim().slice(0,600):'';
}
self.onmessage=async({data})=>{
 if(active)return;
 active=true;
 try{
  status('Loading photo…');
  let image=await RawImage.read(data.url);
  if(image.width*image.height>40000000)throw new Error('Image too large');
  // Keep label detail but bound working memory before loading the models.
  const scale=Math.min(1,1800/Math.max(image.width,image.height));
  if(scale<1)image=await image.resize(Math.round(image.width*scale),Math.round(image.height*scale));
  if(!detector){status('Downloading bottle detection for the first scan…');detector=await pipeline('object-detection','Xenova/detr-resnet-50',{quantized:true});}
  status('Locating bottles and ingredients…');
  const found=selectRegions(await detector(image,{threshold:0.35,percentage:true}));
  const fallback=!found.regions.length;
  const regions=fallback?[{label:'photo',box:{xmin:0,ymin:0,xmax:1,ymax:1}}]:found.regions;
  const warnings=[];
  if(fallback)warnings.push('No separate bottles located. Suggestions below describe the whole photo; try a closer photo for individual bottles.');
  if(found.total>MAX_REGIONS)warnings.push(`Showing ${MAX_REGIONS} of ${found.total} detected objects. Take another photo of the rest.`);
  self.postMessage({regions:regions.map((r,id)=>({...r,id,suggestions:[],text:'',pending:true})),warnings});
  try{
   if(!ocr){status('Loading bottle-label reading…');const {default:Tesseract}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js');ocr=await Tesseract.createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js'});await ocr.setParameters({tessedit_pageseg_mode:'11'});}
  }catch{ocr=null;warnings.push('Label reading is unavailable. Visual suggestions still need your confirmation.');}
  if(!classifier){status('Loading ingredient recognition…');classifier=await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{quantized:true});}
  for(let id=0;id<regions.length;id++){
   status(`Reading item ${id+1} of ${regions.length}…`);
   const r=regions[id],pixels=cropPixels(image,r.box);
   const crop=new RawImage(pixels.data,pixels.width,pixels.height,pixels.channels);
   let text='',visual=[];
   try{if(ocr)text=await readLabel(crop);}catch{if(!warnings.includes('Some labels could not be read.'))warnings.push('Some labels could not be read.');}
   try{visual=await classifier(crop,data.labels);}catch{if(!warnings.includes('Some visual suggestions are unavailable.'))warnings.push('Some visual suggestions are unavailable.');}
   self.postMessage({region:{...r,id,text,suggestions:suggestions(labelMatches(text,data.dictionary),visual,data.labels),pending:false}});
  }
  self.postMessage({done:true,warnings,total:found.total});
 }catch{
  self.postMessage({error:'The scan could not finish. Try a smaller JPG or PNG, check your connection, or add ingredients by text.'});
 }finally{active=false;}
};
