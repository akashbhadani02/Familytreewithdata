
const $=id=>document.getElementById(id);let token=null,familyId=null,people=[],focusPersonId=null;let treeZoom=1;let pinchStartDistance=0,pinchStartZoom=1;const CARD_W=190,GAP=55,LEVEL_GAP=300,START_X=4000;
function showPreview(input,id){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{$(id).src=e.target.result;$(id).style.display='block'};r.readAsDataURL(f)}
function absoluteLink(path){return location.origin+path}
function copyText(text){navigator.clipboard.writeText(text).then(()=>alert('Link copy થઈ ગઈ')).catch(()=>prompt('આ link copy કરો:',text))}
function safe(v){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function init(){
 const m=location.pathname.match(/^\/add\/([^/]+)$/);
 if(m){
   token=m[1];
   // Always show the add form immediately when a member link is opened.
   $('addBox').classList.remove('hidden');
   $('rootBox').classList.add('hidden');
   $('viewBox').classList.add('hidden');
   $('parentText').textContent='Link ચેક થઈ રહી છે...';
   try{
     const r=await fetch('/api/add/'+encodeURIComponent(token),{cache:'no-store'});
     const d=await r.json();
     if(!r.ok || !d.ok){
       $('parentText').innerHTML='<b style="color:#b42318">આ link સાચી નથી અથવા expire થઈ ગઈ છે.</b>';
       $('addName').disabled=true;$('addPhoto').disabled=true;
       return;
     }
     familyId=d.parent.familyId;
     focusPersonId=String(d.parent._id||'');
     const parentDisplay=d.parent.name;
     $('parentText').innerHTML='આ સભ્યનું નામ <b>'+safe(parentDisplay)+'</b>ની નીચે ઉમેરાશે. નામ અને ફોટો ભરીને Add કરો.';
     loadFamily();
   }catch(e){
     $('parentText').innerHTML='<b style="color:#b42318">Link load થઈ શકી નથી. કૃપા કરીને page ફરી ખોલો.</b>';
   }
   return;
 }
 const q=new URLSearchParams(location.search);familyId=q.get('family');
 const readonly=q.get('readonly')==='1';
 const focus=q.get('focus');
 if(focus)focusPersonId=focus;
 document.body.classList.toggle('readonly-view',readonly);
 if(familyId){
   $('viewBox').classList.remove('hidden');
   $('currentLink').textContent=location.href;
   if(readonly){
     $('rootBox').classList.add('hidden');
     $('addBox').classList.add('hidden');
   }
   loadFamily()
 } else $('rootBox').classList.remove('hidden');
}
async function preparePhoto(file){
 if(!file) return null;
 if(file.size<=900*1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
 return await new Promise((resolve,reject)=>{
   const img=new Image();
   const url=URL.createObjectURL(file);
   img.onload=()=>{
     URL.revokeObjectURL(url);
     const max=1200;
     const scale=Math.min(1,max/Math.max(img.width,img.height));
     const c=document.createElement('canvas');
     c.width=Math.max(1,Math.round(img.width*scale));
     c.height=Math.max(1,Math.round(img.height*scale));
     const ctx=c.getContext('2d');
     ctx.drawImage(img,0,0,c.width,c.height);
     c.toBlob(blob=>{
       if(!blob)return reject(new Error('Photo processing failed'));
       resolve(new File([blob],'family-photo.jpg',{type:'image/jpeg'}));
     },'image/jpeg',0.82);
   };
   img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Invalid photo'))};
   img.src=url;
 });
}
async function createRoot(){const name=$('rootName').value.trim();if(!name)return alert('કૃપા કરીને નામ લખો');const fd=new FormData();fd.append('name',name);try{const photo=await preparePhoto($('rootPhoto').files[0]);if(photo)fd.append('photo',photo);}catch(e){return alert('ફોટો upload માટે તૈયાર થઈ શક્યો નથી. બીજો ફોટો પસંદ કરો.');}const r=await fetch('/api/family/start',{method:'POST',body:fd});const raw=await r.text();let d;try{d=JSON.parse(raw)}catch(_){throw new Error('Server upload error ('+r.status+'). Please try again.')}if(!r.ok||!d.ok)return alert(d.error||'Upload failed');familyId=d.familyId;token=d.person.addToken;const link=absoluteLink(d.addLink);$('rootSuccess').style.display='block';$('rootSuccess').innerHTML='<b>નામ સાચવાઈ ગયું! 🎉</b><div>હવે આ link '+safe(name)+'ના દીકરા/આગળના સભ્યને મોકલો:</div><div class="linkbox">'+safe(link)+'</div><div class="copy" onclick="copyText('+JSON.stringify(link)+')">Link copy કરો</div>';history.replaceState({},'', '/?family='+encodeURIComponent(familyId));$('rootBox').classList.add('hidden');$('viewBox').classList.remove('hidden');$('currentLink').textContent=link;loadFamily()}
async function addPerson(){
 const btn=$('addPersonBtn');
 const name=$('addName').value.trim();
 if(!name)return alert('કૃપા કરીને તમારું પૂરું નામ લખો');
 if(!token)return alert('આ add link મળતી નથી');
 if(btn.disabled)return;
 btn.disabled=true;btn.textContent='⏳ Upload થઈ રહ્યું છે...';btn.style.opacity='.6';btn.style.cursor='not-allowed';
 const parentAddToken=token;
 const fd=new FormData();fd.append('name',name);
 try{
   const photo=await preparePhoto($('addPhoto').files[0]);
   if(photo)fd.append('photo',photo);
   const r=await fetch('/api/add/'+token,{method:'POST',body:fd});
   const raw=await r.text();let d;try{d=JSON.parse(raw)}catch(_){throw new Error('Server upload error ('+r.status+'). Please try again.')}
   if(!d.ok)throw new Error(d.error||'નામ add થયું નથી');
   const link=absoluteLink(d.addLink);
   token=d.person.addToken;
   const parentLink=absoluteLink('/add/'+parentAddToken);
   $('addSuccess').style.display='block';
   $('addSuccess').innerHTML='<b>✅ '+safe(name)+'નું નામ સફળતાપૂર્વક ઉમેરાઈ ગયું!</b><div class="nextBox"><b>હવે શું કરવું છે?</b><div style="display:grid;gap:8px;margin-top:10px"><button type="button" class="btn" onclick="copyText('+JSON.stringify(parentLink)+')">👦 આ જ Father માટે બીજો Son ઉમેરો</button><button type="button" class="btn" onclick="copyText('+JSON.stringify(link)+')">➡️ '+safe(name)+'નો Son ઉમેરો</button><button type="button" class="btn" onclick="showFamilyTree()">🌳 Family Tree જુઓ</button></div><div class="linkbox" style="margin-top:8px">બીજો Son ઉમેરવા માટેની link: '+safe(parentLink)+'</div><div class="copy" onclick="copyText('+JSON.stringify(parentLink)+')">🔗 Parent Link Copy કરો</div></div>';
   $('addName').value='';$('addPhoto').value='';$('addPreview').style.display='none';
   $('parentText').innerHTML='હવે આગળનું નામ <b>'+safe(name)+'</b>ની નીચે ઉમેરાશે.';
   await loadFamily();
   alert('✅ Child સફળતાપૂર્વક add થઈ ગયો!');
 }catch(e){
   alert('❌ '+e.message);
 }finally{
   btn.disabled=false;btn.textContent='✅ નામ ઉમેરો';btn.style.opacity='1';btn.style.cursor='pointer';
 }
}
function showFamilyTree(){
 $('addBox').classList.add('hidden');
 $('rootBox').classList.add('hidden');
 $('viewBox').classList.remove('hidden');
 document.body.classList.add('readonly-view');
 history.replaceState({},'', '/?family='+encodeURIComponent(familyId)+'&readonly=1'+(focusPersonId?'&focus='+encodeURIComponent(focusPersonId):''));
 $('currentLink').textContent='Family Tree';
 loadFamily();
 window.scrollTo({top:0,behavior:'smooth'});
}
function showReadOnlyRealTree(){
 if(!familyId)return alert('Family Tree હજુ તૈયાર નથી.');
 document.body.classList.add('readonly-view');
 $('addBox').classList.add('hidden');
 $('rootBox').classList.add('hidden');
 $('viewBox').classList.remove('hidden');
 history.replaceState({},'', '/?family='+encodeURIComponent(familyId)+'&readonly=1'+(focusPersonId?'&focus='+encodeURIComponent(focusPersonId):''));
 $('currentLink').textContent='Family Tree';
 loadFamily().then(()=>{
   requestAnimationFrame(()=>{
     if(typeof toggleUserRealTree==='function' && !document.body.classList.contains('real-tree-open')) toggleUserRealTree();
   });
 });
}
function showReadOnlyTree(){
 if(!familyId)return alert('Family Tree હજુ તૈયાર નથી.');
 document.body.classList.add('readonly-view');
 $('addBox').classList.add('hidden');
 $('rootBox').classList.add('hidden');
 $('viewBox').classList.remove('hidden');
 history.replaceState({},'', '/?family='+encodeURIComponent(familyId)+'&readonly=1'+(focusPersonId?'&focus='+encodeURIComponent(focusPersonId):''));
 $('currentLink').textContent='';
 loadFamily();
 window.scrollTo({top:0,behavior:'smooth'});
}
async function loadFamily(){if(!familyId)return;const r=await fetch('/api/family/'+encodeURIComponent(familyId));const d=await r.json();if(d.ok){people=d.people;renderTree()}}
async function renderTree(){
 const cards=$('cards'),svg=$('svg'),canvas=$('canvas'),layer=$('treeLayer');
 cards.innerHTML='';svg.innerHTML='';if(!people.length)return;

 const NS='http://www.w3.org/2000/svg';
 const CARD_W=230,CARD_H=82,H_GAP=42,V_GAP=105,PAD_X=80,PAD_Y=70;
 const children={};
 const roots=[];
 people.forEach(p=>{
   const pid=p.parentId?String(p.parentId):'root';
   (children[pid]??=[]).push(p);
   if(!p.parentId)roots.push(p);
 });
 Object.values(children).forEach(a=>a.sort((x,y)=>(Number(x.generation)-Number(y.generation))||new Date(x.createdAt)-new Date(y.createdAt)));
 if(!roots.length)return;

 /* Hidden index cards keep search/focus behaviour working; the visible tree is 100% SVG. */
 people.forEach(p=>{
   const c=document.createElement('div');
   c.className='card';
   c.dataset.personId=String(p._id);
   c.dataset.personName=(p.name||'').toLowerCase();
   c.style.display='none';
   cards.appendChild(c);
 });

 const widths={};
 function width(id){
   id=String(id);
   if(widths[id]!=null)return widths[id];
   const kids=children[id]||[];
   widths[id]=kids.length
     ? Math.max(CARD_W,kids.reduce((sum,k)=>sum+width(k._id),0)+H_GAP*(kids.length-1))
     : CARD_W;
   return widths[id];
 }

 const pos={};
 window.__treePositions=pos;

 function place(node,cx,y){
   const id=String(node._id),kids=children[id]||[],w=width(id);
   pos[id]={x:cx-CARD_W/2,y,w};
   if(kids.length){
     let cur=cx-w/2;
     kids.forEach(k=>{
       const kw=width(k._id);
       place(k,cur+kw/2,y+CARD_H+V_GAP);
       cur+=kw+H_GAP;
     });
   }
 }

 /* Support multiple roots by laying them side-by-side. */
 const rootWidths=roots.map(r=>width(r._id));
 let totalRootW=rootWidths.reduce((a,b)=>a+b,0)+H_GAP*Math.max(0,roots.length-1);
 let rootCursor=PAD_X;
 roots.forEach((r,i)=>{
   const rw=rootWidths[i];
   place(r,rootCursor+rw/2,PAD_Y);
   rootCursor+=rw+H_GAP;
 });

 const all=Object.values(pos);
 const maxX=Math.max(1100,totalRootW+PAD_X*2,...all.map(q=>q.x+CARD_W+PAD_X));
 const maxY=Math.max(900,...all.map(q=>q.y+CARD_H+PAD_Y));
 canvas.dataset.baseWidth=maxX;canvas.dataset.baseHeight=maxY;
 applyTreeZoom(maxX,maxY);
 svg.setAttribute('width',maxX);svg.setAttribute('height',maxY);
 svg.setAttribute('viewBox',`0 0 ${maxX} ${maxY}`);

 function el(tag,attrs={}){
   const n=document.createElementNS(NS,tag);
   Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));
   return n;
 }
 function addText(g,text,x,y,size=15,weight='700'){
   const t=el('text',{x,y,'text-anchor':'middle','font-size':size,'font-weight':weight,fill:'#203047','font-family':"Arial,'Noto Sans Gujarati',sans-serif"});
   const value=String(text||'');
   const max=24;
   if(value.length<=max){t.textContent=value;}
   else{
     let line='',lines=[];
     value.split(/\s+/).forEach(word=>{
       if((line+' '+word).trim().length>max){if(line)lines.push(line);line=word;}
       else line=(line+' '+word).trim();
     });
     if(line)lines.push(line);
     lines=lines.slice(0,2);
     lines.forEach((ln,i)=>{
       const sp=el('tspan',{x,y:y+i*19});sp.textContent=ln;t.appendChild(sp);
     });
   }
   g.appendChild(t);
 }

 /* Draw connectors first so they always stay behind the name boxes. */
 people.forEach(p=>{
   if(!p.parentId)return;
   const parent=pos[String(p.parentId)],child=pos[String(p._id)];
   if(!parent||!child)return;
   const x1=parent.x+CARD_W/2,y1=parent.y+CARD_H;
   const x2=child.x+CARD_W/2,y2=child.y;
   const mid=y1+(y2-y1)*0.5;
   const path=el('path',{
     d:`M ${x1} ${y1} V ${mid} C ${x1} ${mid} ${x2} ${mid} ${x2} ${mid} V ${y2}`,
     fill:'none',stroke:'#78909c','stroke-width':4,'stroke-linecap':'round'
   });
   svg.appendChild(path);
 });

 const colors=['#eaf4ff','#eefbf2','#fff8e7','#f6efff','#fff0f0'];
 people.forEach((p,i)=>{
   const q=pos[String(p._id)];if(!q)return;
   const g=el('g',{class:'svg-person-node','data-person-id':String(p._id),cursor:'pointer'});
   const shadow=el('rect',{x:q.x+3,y:q.y+5,width:CARD_W,height:CARD_H,rx:16,fill:'#203047',opacity:.10});
   const rect=el('rect',{x:q.x,y:q.y,width:CARD_W,height:CARD_H,rx:16,fill:colors[i%colors.length],stroke:'#315f91','stroke-width':2});
   g.appendChild(shadow);g.appendChild(rect);
   const name=el('text',{x:q.x+CARD_W/2,y:q.y+34,'text-anchor':'middle','font-size':16,'font-weight':'800',fill:'#203047','font-family':"Arial,'Noto Sans Gujarati',sans-serif"});
   const value=String(p.name||'');
   if(value.length<=25) name.textContent=value;
   else{
     const words=value.split(/\s+/);let a='',b='';
     words.forEach(w=>{if((a+' '+w).trim().length<=25)a=(a+' '+w).trim();else if((b+' '+w).trim().length<=25)b=(b+' '+w).trim();});
     name.textContent='';
     const t1=el('tspan',{x:q.x+CARD_W/2,y:q.y+29});t1.textContent=a;name.appendChild(t1);
     if(b){const t2=el('tspan',{x:q.x+CARD_W/2,y:q.y+48});t2.textContent=b;name.appendChild(t2);}
   }
   g.appendChild(name);
   const gen=el('text',{x:q.x+CARD_W/2,y:q.y+68,'text-anchor':'middle','font-size':11,'font-weight':'700',fill:'#718096','font-family':"Arial,'Noto Sans Gujarati',sans-serif"});
   gen.textContent='Generation '+(p.generation||1);
   g.appendChild(gen);
   g.addEventListener('click',()=>focusTreePerson(String(p._id)));
   svg.appendChild(g);
 });
 window.__treeSvgNodes=svg.querySelectorAll('.svg-person-node');
 if(focusPersonId)requestAnimationFrame(()=>focusTreePerson(focusPersonId));
}
function searchTreePerson(value,focus=false){
 const term=(value||'').trim().toLowerCase();
 const cards=[...document.querySelectorAll('#cards .card')];
 cards.forEach(c=>c.classList.remove('selfFound'));
 if(!term){const h=$('treeSearchHint');if(h)h.textContent='તમારું નામ લખો — તમારું card light green થશે.';return;}
 const matches=cards.filter(c=>(c.dataset.personName||'').includes(term));
 matches.forEach(c=>c.classList.add('selfFound'));
 const h=$('treeSearchHint');if(h)h.textContent=matches.length?`${matches.length} member મળ્યા — light green card પર click/Enter કરો.`:'આ નામ મળ્યું નથી.';
 if(matches.length && (focus||matches.length===1)){
   const id=matches[0].dataset.personId;focusTreePerson(id);
 }
}
function clearTreeSearch(){const i=$('treeSearchInput');if(i)i.value='';document.querySelectorAll('#cards .card.selfFound').forEach(c=>c.classList.remove('selfFound'));const h=$('treeSearchHint');if(h)h.textContent='તમારું નામ લખો — તમારું card light green થશે.'}
function updateTreeZoomLabel(){const el=$('treeZoomLabel');if(el)el.textContent=Math.round(treeZoom*100)+'%'}
function applyTreeZoom(baseW,baseH){const canvas=$('canvas'),layer=$('treeLayer');if(!canvas||!layer)return;const w=Number(baseW||canvas.dataset.baseWidth||canvas.offsetWidth||1000),h=Number(baseH||canvas.dataset.baseHeight||canvas.offsetHeight||900);canvas.dataset.baseWidth=w;canvas.dataset.baseHeight=h;canvas.style.width=(w*treeZoom)+'px';canvas.style.height=(h*treeZoom)+'px';layer.style.width=w+'px';layer.style.height=h+'px';layer.style.transform='scale('+treeZoom+')';updateTreeZoomLabel()}
function setTreeZoom(z, anchorX=null, anchorY=null){const box=document.querySelector('.treebox');if(!box)return;const old=treeZoom;treeZoom=Math.max(.35,Math.min(2.5,z));if(anchorX==null)anchorX=box.clientWidth/2;if(anchorY==null)anchorY=box.clientHeight/2;const worldX=(box.scrollLeft+anchorX)/old,worldY=(box.scrollTop+anchorY)/old;applyTreeZoom();requestAnimationFrame(()=>{box.scrollLeft=Math.max(0,worldX*treeZoom-anchorX);box.scrollTop=Math.max(0,worldY*treeZoom-anchorY);})}
function treeZoomIn(){setTreeZoom(treeZoom+0.1)}
function treeZoomOut(){setTreeZoom(treeZoom-0.1)}
function treeZoomReset(){setTreeZoom(1)}
function treeZoomDistance(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}
function treeZoomCenter(a,b){return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2}}
        function drawUserRealTreeStructure(){
    const layer = $('treeLayer'), normalSvg = $('svg'), baseCanvas = $('canvas');
    if(!layer || !baseCanvas || !people.length) return;
    layer.classList.add('real-natural-tree');
    if(normalSvg) normalSvg.style.display='none';
    const cards=$('cards'); if(cards) cards.style.display='none';
    let tc=$('realTreeCanvas');
    if(!tc){tc=document.createElement('canvas');tc.id='realTreeCanvas';layer.appendChild(tc);}
    const generation=p=>Number(p.generation)||1;
    /* ---------- FAMILY TREE LAYOUT ----------
       Generation 1 is one continuous vertical trunk.
       Every Gen-1 member is stacked bottom -> top in insertion order.
       Generation 2+ branches are created from the correct parent. */
    const gen1 = people.filter(p=>generation(p)===1);
    if(!gen1.length) return;

    // Keep API/insertion order. If createdAt exists, use it as the most reliable
    // insertion order, with the original array position as the final fallback.
    const orderMap = new Map(people.map((p,i)=>[String(p._id),i]));
    gen1.sort((a,b)=>{
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
        if(Number.isFinite(ta) && Number.isFinite(tb) && ta!==tb) return ta-tb;
        return (orderMap.get(String(a._id))||0)-(orderMap.get(String(b._id))||0);
    });

    // Parent -> children. Gen-1 members are the trunk members, not separate roots.
    const generationChildren = new Map();
    people.forEach(p=>{
        const pid = p.parentId ? String(p.parentId) : '';
        if(pid){
            if(!generationChildren.has(pid)) generationChildren.set(pid,[]);
            generationChildren.get(pid).push(p);
        }
    });
    generationChildren.forEach(list=>list.sort((a,b)=>{
        const ia=orderMap.get(String(a._id))||0, ib=orderMap.get(String(b._id))||0;
        return ia-ib;
    }));

    const maxGen = Math.max(...people.map(generation),1);
    const plaqueW = 230;
    const plaqueH = 158;
    const gen1Gap = 190;
    const levelGap = 245;
    const sideGap = 300;
    const topPad = 150;
    const bottomPad = 120;

    // Measure each Gen-1 branch horizontally so Gen-2/3 siblings never overlap.
    const branchWidth = new Map();
    function measureBranch(p){
        const id=String(p._id);
        if(branchWidth.has(id)) return branchWidth.get(id);
        const kids=generationChildren.get(id)||[];
        if(!kids.length){ branchWidth.set(id,plaqueW+80); return plaqueW+80; }
        let total=0;
        kids.forEach((c,i)=>{ total+=measureBranch(c); if(i<kids.length-1) total+=sideGap; });
        total=Math.max(total,plaqueW+80);
        branchWidth.set(id,total);
        return total;
    }
    gen1.forEach(measureBranch);

    const maxBranchWidth=Math.max(...gen1.map(p=>branchWidth.get(String(p._id))||plaqueW+80), plaqueW+80);
    const treeWidth=Math.max(2200, Math.min(14000, Math.max(maxBranchWidth+800, gen1.length*260+1200)));
    const trunkTopY=topPad;
    const trunkBottomY=topPad + (gen1.length-1)*gen1Gap;
    const trunkX=treeWidth/2;
    const pos=new Map();

    // Gen-1: first entered is lowest, newest is highest.
    gen1.forEach((p,i)=>{
        pos.set(String(p._id),{x:trunkX,y:trunkBottomY-i*gen1Gap});
    });

    // Put descendants above their parent and spread siblings horizontally.
    function placeDescendants(parent){
        const pp=pos.get(String(parent._id));
        if(!pp) return;
        const kids=generationChildren.get(String(parent._id))||[];
        if(!kids.length) return;
        let total=kids.reduce((s,c)=>s+measureBranch(c),0)+sideGap*Math.max(0,kids.length-1);
        let cursor=pp.x-total/2;
        kids.forEach(c=>{
            const w=measureBranch(c);
            const x=cursor+w/2;
            const y=pp.y-levelGap;
            pos.set(String(c._id),{x,y});
            placeDescendants(c);
            cursor+=w+sideGap;
        });
    }
    gen1.forEach(placeDescendants);

    // Fit the tree tightly to the actual data: move the complete tree down
    // only enough to keep the highest generation inside the canvas. This
    // removes the large empty area above/below the tree while preserving the
    // bottom-up Gen-1 trunk layout.
    const placed=[...pos.values()];
    const minPlacedY=Math.min(...placed.map(q=>q.y));
    const shiftY=Math.max(0, topPad-minPlacedY);
    if(shiftY){ pos.forEach(q=>{q.y+=shiftY;}); }
    const shiftedGen1Bottom=Math.max(...gen1.map(p=>pos.get(String(p._id)).y));
    const shiftedMaxY=Math.max(...[...pos.values()].map(q=>q.y));
    const groundYTarget=shiftedGen1Bottom+190;
    const treeHeight=Math.max(900, Math.ceil(Math.max(groundYTarget+bottomPad, shiftedMaxY+bottomPad)));

    const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    tc.width=Math.round(treeWidth*dpr);
    tc.height=Math.round(treeHeight*dpr);
    tc.style.width=treeWidth+'px'; tc.style.height=treeHeight+'px';
    tc.style.position='absolute'; tc.style.left='0'; tc.style.top='0';
    tc.style.zIndex='2'; tc.style.display='block'; tc.style.visibility='visible';
    tc.style.opacity='1'; tc.style.pointerEvents='none'; tc.style.maxWidth='none'; tc.style.maxHeight='none';
    layer.style.width=treeWidth+'px'; layer.style.minWidth=treeWidth+'px';
    layer.style.minHeight=treeHeight+'px'; layer.style.height=treeHeight+'px';
    baseCanvas.style.width=treeWidth+'px'; baseCanvas.style.height=treeHeight+'px';
    baseCanvas.dataset.baseWidth=treeWidth; baseCanvas.dataset.baseHeight=treeHeight;
    const treebox=$('treebox');
    if(treebox){ treebox.style.height=''; treebox.style.minHeight=''; treebox.style.maxHeight=''; treebox.style.overflow='auto'; treebox.style.webkitOverflowScrolling='touch'; treebox.scrollTop=0; treebox.scrollLeft=0; }
    layer.style.transform='scale('+treeZoom+')'; updateTreeZoomLabel();
    const ctx=tc.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,treeWidth,treeHeight);

    /* ---------- background ---------- */
    const sky=ctx.createLinearGradient(0,0,0,treeHeight);
    sky.addColorStop(0,'#9bd8f5'); sky.addColorStop(.48,'#dff1d0'); sky.addColorStop(1,'#8fb65c');
    ctx.fillStyle=sky; ctx.fillRect(0,0,treeWidth,treeHeight);
    function cloud(x,y,s){ctx.save();ctx.fillStyle='rgba(255,255,255,.58)';[0,35,70].forEach((dx,i)=>{ctx.beginPath();ctx.arc(x+dx*s,y+(i%2?8:0),28*s,0,Math.PI*2);ctx.fill();});ctx.restore();}
    cloud(treeWidth*.16,120,1); cloud(treeWidth*.78,170,.9);
    const groundY=shiftedGen1Bottom+150; ctx.fillStyle='#5f9345'; ctx.fillRect(0,groundY,treeWidth,treeHeight-groundY);

    function woodGradient(x1,y1,x2,y2){const g=ctx.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'#35190c');g.addColorStop(.18,'#63361a');g.addColorStop(.42,'#9a5b2a');g.addColorStop(.58,'#c27a3d');g.addColorStop(.78,'#74401e');g.addColorStop(1,'#2d1409');return g;}
    function strokeCurve(x1,y1,c1x,c1y,c2x,c2y,x2,y2,width){ctx.save();ctx.beginPath();ctx.moveTo(x1,y1);ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);ctx.strokeStyle='rgba(45,20,8,.30)';ctx.lineWidth=width+10;ctx.lineCap='round';ctx.stroke();ctx.beginPath();ctx.moveTo(x1,y1);ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);ctx.strokeStyle=woodGradient(x1,y1,x2,y2);ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();ctx.beginPath();ctx.moveTo(x1-width*.08,y1);ctx.bezierCurveTo(c1x-width*.04,c1y-3,c2x-width*.04,c2y-3,x2-width*.03,y2-2);ctx.strokeStyle='rgba(239,174,101,.38)';ctx.lineWidth=Math.max(2,width*.11);ctx.stroke();ctx.restore();}
    function twig(x1,y1,x2,y2,width){ctx.save();ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo((x1+x2)/2+20,(y1+y2)/2-20,x2,y2);ctx.strokeStyle='#4b2814';ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();ctx.restore();}
    function leaf(x,y,rx,ry,angle,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    function foliage(x,y,scale=1){const colors=['#2e6e2d','#3f8736','#5da447','#78b84f','#98c95a'];const pts=[[-45,12,30,18,-.5],[-25,-25,35,20,-.25],[8,-38,38,21,.05],[40,-15,33,19,.35],[52,15,27,17,.55],[5,15,45,24,.1],[-2,-70,27,17,-.15]];pts.forEach((p,i)=>leaf(x+p[0]*scale,y+p[1]*scale,p[2]*scale,p[3]*scale,p[4],colors[i%colors.length]));}

    const realPhotoCache=window.__realTreePhotoCache||(window.__realTreePhotoCache=new Map());
    let realPhotoRedrawQueued=false;
    function queueRealTreePhotoRedraw(){if(realPhotoRedrawQueued)return;realPhotoRedrawQueued=true;requestAnimationFrame(()=>{realPhotoRedrawQueued=false;if(document.body.classList.contains('real-tree-open')||document.getElementById('viewer')?.classList.contains('real-tree-open'))drawUserRealTreeStructure();});}
    function drawMemberPhoto(person,x,y,radius=34){const src=String(person.photo||'').trim();ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle='#eef2f5';ctx.fill();ctx.clip();if(src){let entry=realPhotoCache.get(src);if(!entry){const img=new Image();entry={img,loaded:false,failed:false};realPhotoCache.set(src,entry);img.onload=()=>{entry.loaded=true;queueRealTreePhotoRedraw()};img.onerror=()=>{entry.failed=true;queueRealTreePhotoRedraw()};img.src=src;}if(entry.loaded&&!entry.failed){const img=entry.img,iw=img.naturalWidth||img.width||1,ih=img.naturalHeight||img.height||1,ratio=Math.max(radius*2/iw,radius*2/ih),dw=iw*ratio,dh=ih*ratio;ctx.drawImage(img,x-dw/2,y-dh/2,dw,dh);}else{ctx.fillStyle='#e5ebef';ctx.fill();ctx.fillStyle='#78909c';ctx.font='700 28px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((String(person.name||'?')[0]||'?').toUpperCase(),x,y);}}else{ctx.fillStyle='#e5ebef';ctx.fill();ctx.fillStyle='#78909c';ctx.font='700 28px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((String(person.name||'?')[0]||'?').toUpperCase(),x,y);}ctx.restore();ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.strokeStyle='#f2c879';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#5b3218';ctx.lineWidth=2;ctx.stroke();ctx.restore();}

    function wrapName(name,maxWidth,font){
        ctx.font=font;
        const words=String(name||'').trim().split(/\s+/).filter(Boolean);
        if(!words.length) return [''];
        const lines=[]; let line='';
        words.forEach(word=>{
            const test=line?line+' '+word:word;
            if(ctx.measureText(test).width<=maxWidth || !line){line=test;}
            else{lines.push(line);line=word;}
        });
        if(line) lines.push(line);
        return lines.slice(0,3);
    }
    function plaque(p,x,y,small=false){
        const name=String(p.name||'').trim(); if(!name)return;
        const cardW=230, cardH=164, top=y-cardH/2;
        ctx.save();ctx.shadowColor='rgba(30,15,5,.32)';ctx.shadowBlur=10;ctx.shadowOffsetY=5;ctx.fillStyle='#c98543';ctx.strokeStyle='#5b3218';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(x-cardW/2,top,cardW,cardH,14);ctx.fill();ctx.stroke();ctx.restore();
        drawMemberPhoto(p,x,top+42,31);
        const font='800 '+(small?15:17)+'px Arial, "Noto Sans Gujarati", sans-serif';
        const lines=wrapName(name,195,font);
        ctx.save();ctx.fillStyle='#2d1609';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=font;
        const start=top+88-(lines.length-1)*9;lines.forEach((line,i)=>ctx.fillText(line,x,start+i*20));
        ctx.font='700 11px Arial';ctx.fillStyle='#5b3218';ctx.fillText('Generation '+generation(p),x,top+139);ctx.restore();
    }

    /* ---------- ONE LARGE CONTINUOUS GEN-1 TRUNK ---------- */
    strokeCurve(trunkX-115,groundY+10,trunkX-170,groundY-190,trunkX-120,trunkBottomY+170,trunkX-52,trunkTopY,105);
    strokeCurve(trunkX+115,groundY+10,trunkX+170,groundY-190,trunkX+120,trunkBottomY+170,trunkX+52,trunkTopY,105);
    strokeCurve(trunkX,groundY,trunkX-40,groundY-260,trunkX-30,trunkBottomY+120,trunkX,trunkTopY-5,120);
    // A central spine runs behind every Gen-1 plaque, so all Gen-1 members visibly belong to one trunk.
    strokeCurve(trunkX,trunkBottomY+55,trunkX-18,trunkBottomY-20,trunkX+18,trunkTopY+90,trunkX,trunkTopY-20,92);
    for(let i=-6;i<=6;i++){ctx.beginPath();ctx.moveTo(trunkX+i*12,groundY-10);ctx.quadraticCurveTo(trunkX+i*15,(groundY+trunkTopY)/2,trunkX+i*7,trunkTopY+35);ctx.strokeStyle='rgba(46,21,8,.25)';ctx.lineWidth=3;ctx.stroke();}

    // IMPORTANT: draw every branch/twig BEFORE any member plaque.
    // This keeps branches physically behind the cards, so no branch/wood line
    // can ever appear across a name card. The branch becomes visible only
    // outside the card and visually joins the trunk/parent edge.
    function drawDescendantBranches(parent){
        const pp=pos.get(String(parent._id)); if(!pp)return;
        const kids=generationChildren.get(String(parent._id))||[];
        kids.forEach(child=>{
            const cp=pos.get(String(child._id)); if(!cp)return;
            const dx=cp.x-pp.x, side=dx>=0?1:-1, distance=Math.abs(dx);
            const width=Math.max(10,34-(generation(parent)-1)*4);
            // Never start a branch inside a card. Cards are 164px tall, so
            // the branch starts just above the parent's top edge and ends
            // just below the child's bottom edge. This also applies to Gen-1.
            const CARD_H = 164;
            const parentEdgeY = pp.y - CARD_H/2 - 3;
            const childEdgeY  = cp.y + CARD_H/2 + 3;
            strokeCurve(pp.x,parentEdgeY,
                pp.x+side*Math.max(80,Math.min(260,distance*.42)),pp.y-110,
                cp.x-side*Math.max(70,Math.min(240,distance*.30)),cp.y+110,
                cp.x,childEdgeY,width);
            const childKids = generationChildren.get(String(child._id)) || [];
            // ONLY the last generation gets twigs/leaves. Intermediate generations stay clean.
            if(childKids.length === 0){
                twig(cp.x,cp.y+20,cp.x+side*65,cp.y-65,6);
                foliage(cp.x+side*78,cp.y-85,.72);
            }
            drawDescendantBranches(child);
        });
    }
    gen1.forEach(p=>drawDescendantBranches(p));

    // Paint ALL plaques last. Cards therefore sit cleanly on top of the trunk/branches.
    // No branch, twig or wood stroke can cover any card or name.
    people.forEach(p=>{
        const pp=pos.get(String(p._id));
        if(pp) plaque(p,pp.x,pp.y,false);
    });

    // Small foliage at the top and side of the real tree.
    // Leaves are shown ONLY on the final (last) generation. No leaves on the trunk/top.
}

function toggleUserRealTree(){
 const view=$('viewBox'), btn=$('userRealTreeBtn');
 if(!view)return;
 const opening=!document.body.classList.contains('real-tree-open');
 if(opening){
   document.body.classList.add('real-tree-open');
   view.classList.add('real-tree-open');
   if(btn) btn.textContent='✕ Close Real Tree';
   treeZoom=1;
   requestAnimationFrame(()=>{
     try{ drawUserRealTreeStructure(); }
     catch(e){ console.error('Real Tree render error:',e); }
   });
 }else{
   document.body.classList.remove('real-tree-open');
   view.classList.remove('real-tree-open');
   if(btn) btn.textContent='🌳 Real Tree View';
   const rc=$('realTreeCanvas'); if(rc)rc.remove();
   const svg=$('svg'); if(svg)svg.style.display='';
   const cards=$('cards'); if(cards)cards.style.display='';
   const layer=$('treeLayer'); if(layer){layer.classList.remove('real-natural-tree');layer.style.width='';layer.style.height='';layer.style.minWidth='';layer.style.minHeight='';layer.style.transform='scale('+treeZoom+')';}
   const canvas=$('canvas'); if(canvas){canvas.style.width='';canvas.style.height='';}
   renderTree();
 }
}

function initTreeZoomTouch(){
 const box=document.querySelector('.treebox');if(!box||box.dataset.zoomReady)return;box.dataset.zoomReady='1';
 let pinchStartDistance=0,pinchStartZoom=1,pinchWorldX=0,pinchWorldY=0,drag=false,lastX=0,lastY=0,touchMode='';
 box.addEventListener('wheel',e=>{e.preventDefault();const r=box.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;setTreeZoom(treeZoom+(e.deltaY<0?.08:-.08),x,y)},{passive:false});
 box.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;drag=true;lastX=e.clientX;lastY=e.clientY;box.classList.add('dragging');box.setPointerCapture?.(e.pointerId)});
 box.addEventListener('pointermove',e=>{if(!drag)return;box.scrollLeft-=e.clientX-lastX;box.scrollTop-=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY});
 ['pointerup','pointercancel','pointerleave'].forEach(t=>box.addEventListener(t,()=>{drag=false;box.classList.remove('dragging')}));
 box.addEventListener('touchstart',e=>{
   if(e.touches.length===2){
     e.preventDefault();touchMode='pinch';
     const c=treeZoomCenter(e.touches[0],e.touches[1]),r=box.getBoundingClientRect();
     pinchStartDistance=treeZoomDistance(e.touches[0],e.touches[1]);pinchStartZoom=treeZoom;
     pinchWorldX=(box.scrollLeft+c.x-r.left)/treeZoom;pinchWorldY=(box.scrollTop+c.y-r.top)/treeZoom;
   }else if(e.touches.length===1){touchMode='pan';lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;box.classList.add('dragging');}
 },{passive:false});
 box.addEventListener('touchmove',e=>{
   if(e.touches.length===2&&pinchStartDistance){
     e.preventDefault();
     const d=treeZoomDistance(e.touches[0],e.touches[1]),c=treeZoomCenter(e.touches[0],e.touches[1]),r=box.getBoundingClientRect();
     treeZoom=Math.max(.35,Math.min(2.5,pinchStartZoom*(d/pinchStartDistance)));applyTreeZoom();
     requestAnimationFrame(()=>{box.scrollLeft=Math.max(0,pinchWorldX*treeZoom-(c.x-r.left));box.scrollTop=Math.max(0,pinchWorldY*treeZoom-(c.y-r.top))});
   }else if(e.touches.length===1&&touchMode==='pan'){
     e.preventDefault();const x=e.touches[0].clientX,y=e.touches[0].clientY;box.scrollLeft-=x-lastX;box.scrollTop-=y-lastY;lastX=x;lastY=y;
   }
 },{passive:false});
 box.addEventListener('touchend',e=>{if(e.touches.length===0){pinchStartDistance=0;touchMode='';box.classList.remove('dragging')}else if(e.touches.length===1){pinchStartDistance=0;touchMode='pan';lastX=e.touches[0].clientX;lastY=e.touches[0].clientY}},{passive:false});
 box.addEventListener('touchcancel',()=>{pinchStartDistance=0;touchMode='';box.classList.remove('dragging')},{passive:false});
}
function focusTreePerson(id){
 const treebox=document.querySelector('.treebox');
 const card=[...document.querySelectorAll('#cards .card')].find(el=>{
   const person=people.find(p=>String(p._id)===String(id));
   return !!person;
 });
 const person=people.find(p=>String(p._id)===String(id));
 if(!treebox||!person)return;
 const q=window.__treePositions&&window.__treePositions[String(id)];
 if(q){
   treebox.scrollLeft=Math.max(0,(q.x+CARD_W/2)*treeZoom-treebox.clientWidth/2);
   treebox.scrollTop=Math.max(0,(q.y+145/2)*treeZoom-treebox.clientHeight/2);
 }else if(card){
   treebox.scrollLeft=Math.max(0,(card.offsetLeft+CARD_W/2)*treeZoom-treebox.clientWidth/2);
   treebox.scrollTop=Math.max(0,(card.offsetTop+145/2)*treeZoom-treebox.clientHeight/2);
 }
}
function draw(svg,x1,y1,x2,y2){const ns='http://www.w3.org/2000/svg',p=document.createElementNS(ns,'path');p.setAttribute('d',`M${x1} ${y1} L${x2} ${y2}`);p.setAttribute('fill','none');p.setAttribute('stroke','#64748b');p.setAttribute('stroke-width','5');p.setAttribute('stroke-linecap','butt');p.setAttribute('stroke-linejoin','miter');svg.appendChild(p)}
function avatar(n){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e7edf5"/><text x="50" y="62" text-anchor="middle" font-size="42" font-family="Arial" font-weight="700" fill="#61758e">${(n||'?')[0].toUpperCase()}</text></svg>`)}
function copyCurrentLink(){copyText(location.href)}
async function downloadPNG(){if(!people.length)return alert('Tree ખાલી છે');if(!window.html2canvas){const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';document.head.appendChild(s);await new Promise(r=>s.onload=r)}const c=await html2canvas($('canvas'),{scale:2,backgroundColor:'#fbfcfe'}),a=document.createElement('a');a.download='family-tree.png';a.href=c.toDataURL('image/png');a.click()}
init();
initTreeZoomTouch();

let photoTargetId=null;function openPhotoChoice(id){photoTargetId=id;document.getElementById('photoChoiceOverlay').classList.add('show')}function closePhotoChoice(){document.getElementById('photoChoiceOverlay').classList.remove('show');photoTargetId=null}function setPhoto(file){if(!file||!photoTargetId){closePhotoChoice();return}const target=document.getElementById(photoTargetId);const dt=new DataTransfer();dt.items.add(file);target.files=dt.files;target.dispatchEvent(new Event('change',{bubbles:true}));closePhotoChoice()}function chooseCamera(){const i=document.getElementById('cameraPicker');i.value='';i.onchange=()=>setPhoto(i.files&&i.files[0]);i.click()}function chooseGallery(){const i=document.getElementById('galleryPicker');i.value='';i.onchange=()=>setPhoto(i.files&&i.files[0]);i.click()}
// Mobile browser Back/Swipe support is implemented in index.html.
