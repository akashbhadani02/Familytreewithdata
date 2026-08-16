
        let key = localStorage.getItem('adminKey') || '';
        let people = [];
        let currentFamilyId = '';
        let treeZoom=1; let pinchStartDistance=0; let pinchStartZoom=1;
        const $ = id => document.getElementById(id);

        const TREE_DELETE_PASSWORD = 'Delete';

        function showAdminApp(){ $('login').style.display='none'; $('app').style.display='block'; }
        function showLogin(){ $('app').style.display='none'; $('login').style.display='block'; }

        async function login(){
            const entered=$('key').value.trim();
            if(!entered) return alert('Admin password નાખો.');
            key=entered; localStorage.setItem('adminKey',key);
            const ok=await checkAdmin();
            if(ok){ $('key').value=''; showAdminApp(); await loadFamilies(); }
            else { localStorage.removeItem('adminKey'); key=''; }
        }
        function logout(){ key=''; localStorage.removeItem('adminKey'); currentFamilyId=''; location.reload(); }

        async function checkAdmin(){
            try{
                const r=await fetch('/api/admin/families',{headers:{'x-admin-key':key}});
                if(r.ok) return true;
                const d=await r.json().catch(()=>({}));
                alert(d.error||'Admin password ખોટો છે.');
                return false;
            }catch(e){ alert('Server connection error.'); return false; }
        }

        async function loadFamilies(){
            if(!key){showLogin();return;}
            try{
                const r=await fetch('/api/admin/families',{headers:{'x-admin-key':key}});
                const d=await r.json();
                if(!r.ok||!d.ok){localStorage.removeItem('adminKey');key='';showLogin();return;}
                showAdminApp();
                const box=$('families'); box.innerHTML='';
                if(!d.families.length){box.innerHTML='<div class="empty">હજુ કોઈ Family નથી.<br><button class="btn" style="margin-top:12px" onclick="createFamily()">➕ પ્રથમ Family બનાવો</button></div>';return;}
                for(const f of d.families){
                    const div=document.createElement('div'); div.className='family';
                    const mainPerson = f.mainPerson || 'Main Person';
                    const displayMain=mainPerson;
                    div.innerHTML=`<div style="font-size:18px;font-weight:900;color:#1f2937;margin-bottom:5px">👤 ${esc(displayMain)}</div><b>Family ID: ${esc(f._id)}</b><div>સભ્યો: ${f.people}</div><div class="family-actions"><button class="btn" onclick="viewFamily('${escAttr(f._id)}')">🌳 Tree જુઓ</button><button class="btn danger" onclick="deleteFamily('${escAttr(f._id)}')">🗑️ Delete Tree</button></div>`;
                    box.appendChild(div);
                }
            }catch(e){alert('Families load error: '+e.message);}
        }

        async function prepareAdminPhoto(file){
    if(!file) return null;
    if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new Error('માત્ર image photo પસંદ કરો.');
    // Vercel serverless requests have a much smaller practical request limit than 50MB.
    // Accept up to 50MB from the phone, then compress it in the browser before upload.
    if(file.size <= 900*1024 && /^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
    return await new Promise((resolve,reject)=>{
        const img=new Image(); const url=URL.createObjectURL(file);
        img.onload=()=>{
            URL.revokeObjectURL(url);
            const max=1600, scale=Math.min(1,max/Math.max(img.width,img.height));
            const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
            const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,c.width,c.height);
            const make=(q)=>c.toBlob(b=>{
                if(!b) return reject(new Error('Photo processing failed'));
                if(b.size>4*1024*1024 && q>0.55) return make(q-0.08);
                resolve(new File([b],'family-photo.jpg',{type:'image/jpeg'}));
            },'image/jpeg',q);
            make(0.82);
        };
        img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Invalid photo'))}; img.src=url;
    });
}

async function createFamily(){
            const name=prompt('નવી Family માટે પ્રથમ સભ્યનું પૂરું નામ લખો:');
            if(!name||!name.trim())return;
            const fd=new FormData(); fd.append('name',name.trim());
            try{
                const r=await fetch('/api/family/start',{method:'POST',body:fd}); const raw=await r.text(); let d; try{d=JSON.parse(raw)}catch(_){throw new Error('Server upload error ('+r.status+'). Please try again.')}
                if(!r.ok||!d.ok)return alert(d.error||'Family બનાવી શકાઈ નથી');
                await loadFamilies(); await viewFamily(d.familyId);
            }catch(e){alert('Create error: '+e.message);}
        }

        async function confirmTreeDelete(){
            const password=prompt('આખી Tree delete કરવા password નાખો:');
            if(password===null)return false;
            if(password!==TREE_DELETE_PASSWORD){
                alert('Password ખોટો છે. Tree delete થઈ નથી.');
                return false;
            }
            return confirm('આખી Tree અને બધા members કાયમ માટે delete કરવા confirm કરો?');
        }

        async function deleteFamily(id){
            if(!(await confirmTreeDelete()))return;
            try{
                const r=await fetch('/api/admin/family/'+encodeURIComponent(id),{method:'DELETE',headers:{'x-admin-key':key}}); const d=await r.json();
                if(!r.ok||!d.ok)return alert(d.error||'Tree delete થઈ નથી');
                if(currentFamilyId===id){currentFamilyId='';people=[];$('viewer').style.display='none';}
                await loadFamilies(); alert('આખી Family Tree delete થઈ ગઈ.');
            }catch(e){alert('Delete error: '+e.message);}
        }
        async function deleteCurrentFamily(){if(currentFamilyId)await deleteFamily(currentFamilyId);}

        async function viewFamily(id){
            currentFamilyId=id;
            try{
                const r=await fetch('/api/family/'+encodeURIComponent(id)); const d=await r.json();
                if(!r.ok||!d.ok)return alert(d.error||'Tree load થઈ નથી');
                people=Array.isArray(d.people)?d.people:[];
                $('viewer').style.display='block'; renderTree();
                $('viewer').scrollIntoView({behavior:'smooth',block:'start'});
                setTimeout(focusTreeRoot,150);
            }catch(e){alert('Tree load error: '+e.message);}
        }

        async function renderTree(){
 const cards=$('cards'),svg=$('svg'),canvas=$('canvas');
 cards.innerHTML='';svg.innerHTML='';
 if(!people.length){cards.innerHTML='<div class="empty">આ Family માં member નથી.</div>';return;}

 const NS='http://www.w3.org/2000/svg';
 const CARD_W=230,CARD_H=82,H_GAP=42,V_GAP=105,PAD_X=80,PAD_Y=70;
 const children=new Map(),roots=[];
 people.forEach(p=>{
   const pid=p.parentId?String(p.parentId):'root';
   if(!children.has(pid))children.set(pid,[]);
   children.get(pid).push(p);
   if(!p.parentId)roots.push(p);
 });
 children.forEach(a=>a.sort((x,y)=>(Number(x.generation)-Number(y.generation))||new Date(x.createdAt)-new Date(y.createdAt)));
 if(!roots.length)return;

 /* Keep lightweight hidden cards for existing search/focus functions. */
 people.forEach(p=>{
   const d=document.createElement('div');
   d.className='card';
   d.dataset.personId=String(p._id);
   d.dataset.personName=(p.name||'').toLowerCase();
   d.style.display='none';
   cards.appendChild(d);
 });

 const widths=new Map();
 function width(id){
   id=String(id);
   if(widths.has(id))return widths.get(id);
   const kids=children.get(id)||[];
   const w=kids.length?Math.max(CARD_W,kids.reduce((sum,k)=>sum+width(k._id),0)+H_GAP*(kids.length-1)):CARD_W;
   widths.set(id,w);return w;
 }
 const positions=new Map();
 function place(node,cx,y){
   const id=String(node._id),kids=children.get(id)||[],w=width(id);
   positions.set(id,{x:cx-CARD_W/2,y,w});
   if(kids.length){
     let cur=cx-w/2;
     kids.forEach(k=>{const kw=width(k._id);place(k,cur+kw/2,y+CARD_H+V_GAP);cur+=kw+H_GAP;});
   }
 }
 const rootWidths=roots.map(r=>width(r._id));
 let cursor=PAD_X;
 roots.forEach((r,i)=>{const rw=rootWidths[i];place(r,cursor+rw/2,PAD_Y);cursor+=rw+H_GAP;});
 const all=[...positions.values()];
 const maxX=Math.max(1100,...all.map(q=>q.x+CARD_W+PAD_X));
 const maxY=Math.max(900,...all.map(q=>q.y+CARD_H+PAD_Y));
 canvas.dataset.baseWidth=maxX;canvas.dataset.baseHeight=maxY;
 applyTreeZoom(maxX,maxY);
 svg.setAttribute('width',maxX);svg.setAttribute('height',maxY);svg.setAttribute('viewBox',`0 0 ${maxX} ${maxY}`);

 const el=(tag,attrs={})=>{
   const n=document.createElementNS(NS,tag);
   Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));
   return n;
 };
 const colors=['#eaf4ff','#eefbf2','#fff8e7','#f6efff','#fff0f0'];

 /* SVG connectors */
 people.forEach(p=>{
   if(!p.parentId)return;
   const parent=positions.get(String(p.parentId)),child=positions.get(String(p._id));
   if(!parent||!child)return;
   const x1=parent.x+CARD_W/2,y1=parent.y+CARD_H,x2=child.x+CARD_W/2,y2=child.y,mid=y1+(y2-y1)*.5;
   svg.appendChild(el('path',{d:`M ${x1} ${y1} V ${mid} C ${x1} ${mid} ${x2} ${mid} ${x2} ${mid} V ${y2}`,fill:'none',stroke:'#78909c','stroke-width':4,'stroke-linecap':'round'}));
 });

 people.forEach((p,i)=>{
   const q=positions.get(String(p._id));if(!q)return;
   const g=el('g',{class:'svg-person-node','data-person-id':String(p._id),cursor:'pointer'});
   g.appendChild(el('rect',{x:q.x+3,y:q.y+5,width:CARD_W,height:CARD_H,rx:16,fill:'#203047',opacity:.10}));
   g.appendChild(el('rect',{x:q.x,y:q.y,width:CARD_W,height:CARD_H,rx:16,fill:colors[i%colors.length],stroke:'#315f91','stroke-width':2}));
   const name=el('text',{x:q.x+CARD_W/2,y:q.y+34,'text-anchor':'middle','font-size':16,'font-weight':'800',fill:'#203047','font-family':"Arial,'Noto Sans Gujarati',sans-serif"});
   const value=String(p.name||'');
   if(value.length<=25)name.textContent=value;
   else{
     const words=value.split(/\s+/);let a='',b='';
     words.forEach(w=>{if((a+' '+w).trim().length<=25)a=(a+' '+w).trim();else if((b+' '+w).trim().length<=25)b=(b+' '+w).trim();});
     name.textContent='';
     const t1=el('tspan',{x:q.x+CARD_W/2,y:q.y+29});t1.textContent=a;name.appendChild(t1);
     if(b){const t2=el('tspan',{x:q.x+CARD_W/2,y:q.y+48});t2.textContent=b;name.appendChild(t2);}
   }
   g.appendChild(name);
   const gen=el('text',{x:q.x+CARD_W/2,y:q.y+68,'text-anchor':'middle','font-size':11,'font-weight':'700',fill:'#718096','font-family':"Arial,'Noto Sans Gujarati',sans-serif"});
   gen.textContent='Generation '+(p.generation||1);g.appendChild(gen);
   g.addEventListener('click',()=>focusAdminTreePerson(String(p._id)));
   svg.appendChild(g);
 });
 window.__treePositions=Object.fromEntries([...positions].map(([id,q])=>[id,q]));
}
function searchAdminTree(value,focus=false){
 const term=(value||'').trim().toLowerCase();
 const cards=[...document.querySelectorAll('#cards .card')]; cards.forEach(c=>c.classList.remove('selfFound'));
 if(!term){$('treeSearchHint').textContent='તમારું નામ લખો — તમારું card light green થશે.';return;}
 const matches=cards.filter(c=>(c.dataset.personName||'').includes(term)); matches.forEach(c=>c.classList.add('selfFound'));
 $('treeSearchHint').textContent=matches.length?`${matches.length} member મળ્યા.`:'આ નામ મળ્યું નથી.';
 if(matches.length&&(focus||matches.length===1)) focusAdminTreePerson(matches[0].dataset.personId);
}
function clearAdminTreeSearch(){const i=$('treeSearchInput');if(i)i.value='';document.querySelectorAll('#cards .card.selfFound').forEach(c=>c.classList.remove('selfFound'));$('treeSearchHint').textContent='તમારું નામ લખો — તમારું card light green થશે.'}
function focusAdminTreePerson(id){const box=$('treebox'),p=people.find(x=>String(x._id)===String(id));if(!box||!p)return;const card=[...$('cards').children].find(c=>c.dataset.personId===String(id));if(card){box.scrollLeft=Math.max(0,card.offsetLeft*treeZoom+card.offsetWidth*treeZoom/2-box.clientWidth/2);box.scrollTop=Math.max(0,card.offsetTop*treeZoom+card.offsetHeight*treeZoom/2-box.clientHeight/2)}}
function setTreeZoom(z,anchorX=null,anchorY=null){const box=$('treebox');if(!box)return;const old=treeZoom;treeZoom=Math.max(.35,Math.min(2.5,z));if(anchorX==null)anchorX=box.clientWidth/2;if(anchorY==null)anchorY=box.clientHeight/2;const worldX=(box.scrollLeft+anchorX)/old,worldY=(box.scrollTop+anchorY)/old;applyTreeZoom();requestAnimationFrame(()=>{box.scrollLeft=Math.max(0,worldX*treeZoom-anchorX);box.scrollTop=Math.max(0,worldY*treeZoom-anchorY)})}
        function treeZoomIn(){setTreeZoom(treeZoom+0.1)}
        function treeZoomOut(){setTreeZoom(treeZoom-0.1)}
        function treeZoomReset(){setTreeZoom(1)}
        function treeZoomDistance(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}
function treeZoomCenter(a,b){return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2}}
function initTreeZoomTouch(){const box=$('treebox');if(!box||box.dataset.zoomReady)return;box.dataset.zoomReady='1';let pinchStartDistance=0,pinchStartZoom=1,pinchWorldX=0,pinchWorldY=0,drag=false,lastX=0,lastY=0;
 box.addEventListener('wheel',e=>{e.preventDefault();const r=box.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;setTreeZoom(treeZoom+(e.deltaY<0?.08:-.08),x,y)},{passive:false});
 box.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;drag=true;lastX=e.clientX;lastY=e.clientY;box.classList.add('dragging');box.setPointerCapture?.(e.pointerId)});box.addEventListener('pointermove',e=>{if(!drag)return;box.scrollLeft-=e.clientX-lastX;box.scrollTop-=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY});['pointerup','pointercancel'].forEach(t=>box.addEventListener(t,()=>{drag=false;box.classList.remove('dragging')}));
 box.addEventListener('touchstart',e=>{if(e.touches.length===2){e.preventDefault();const c=treeZoomCenter(e.touches[0],e.touches[1]),r=box.getBoundingClientRect();pinchStartDistance=treeZoomDistance(e.touches[0],e.touches[1]);pinchStartZoom=treeZoom;pinchWorldX=(box.scrollLeft+c.x-r.left)/treeZoom;pinchWorldY=(box.scrollTop+c.y-r.top)/treeZoom}},{passive:false});box.addEventListener('touchmove',e=>{if(e.touches.length!==2||!pinchStartDistance)return;e.preventDefault();const d=treeZoomDistance(e.touches[0],e.touches[1]),c=treeZoomCenter(e.touches[0],e.touches[1]),r=box.getBoundingClientRect();treeZoom=Math.max(.35,Math.min(2.5,pinchStartZoom*(d/pinchStartDistance)));applyTreeZoom();requestAnimationFrame(()=>{box.scrollLeft=Math.max(0,pinchWorldX*treeZoom-(c.x-r.left));box.scrollTop=Math.max(0,pinchWorldY*treeZoom-(c.y-r.top))})},{passive:false});box.addEventListener('touchend',e=>{if(e.touches.length<2)pinchStartDistance=0},{passive:false})}

        function focusTreeRoot(){
            const box=$('treebox'), root=people.find(p=>!p.parentId);
            if(!box||!root)return;
            const card=[...$('cards').children].find(el=>el.querySelector('b')?.textContent===root.name);
            if(card)box.scrollTo({left:Math.max(0,card.offsetLeft-box.clientWidth/2+card.offsetWidth/2),top:Math.max(0,card.offsetTop-20),behavior:'smooth'});
        }

        async function renderMemberLinks(){
            const box=$('memberLinks'); box.innerHTML='';
            const localized={}; people.forEach(p=>{localized[String(p._id)]=p.name});
            people.forEach(p=>{
                const link=addLink(p.addToken), item=document.createElement('div'); item.className='member-item';
                item.innerHTML=`<div class="name">${esc(localized[String(p._id)]||p.name)}</div><small>Generation ${p.generation}</small><input class="member-link" value="${esc(link)}" readonly><div class="tool-row"><button class="btn" onclick="copyLink('${escAttr(link)}')">🔗 Copy Link</button><button class="btn" onclick="adminAddChild('${escAttr(p._id)}','${escAttr(p.name)}',this)">➕ Add Son</button><button class="btn gray" onclick="editName('${escAttr(p._id)}')">✏️ Name</button><button class="btn" onclick="updateMemberPhoto('${escAttr(p._id)}')">📷 Update Photo</button><button class="btn danger" onclick="deleteMemberPhoto('${escAttr(p._id)}')">🗑️ Delete Photo</button><button class="btn danger" onclick="deleteMember('${escAttr(p._id)}')">🗑️ Delete Member</button></div>`;
                box.appendChild(item);
            });
        }
        function addLink(token){return location.origin+'/add/'+token;}
        async function copyLink(link){try{await navigator.clipboard.writeText(link);alert('Link copy થઈ ગઈ.');}catch(e){prompt('Link copy કરો:',link);}}

        function openAdminMemberLink(token){
            if(!token) return alert('આ member ની link ઉપલબ્ધ નથી.');
            const link=location.origin+'/add/'+encodeURIComponent(token);
            window.open(link,'_blank','noopener,noreferrer');
        }

        async function adminAddChild(parentId,parentName,btn){
            if(btn && btn.disabled) return;
            if(btn){
                btn.disabled=true;
                btn.dataset.oldText=btn.textContent;
                btn.textContent='⏳ Saving...';
                btn.style.opacity='.6';
                btn.style.cursor='not-allowed';
            }
            try{
                const name=prompt('"'+parentName+'" ના નીચે જે સભ્ય ઉમેરવો છે તેનું નામ લખો:');
                if(!name || !name.trim()) return;

                const wantPhoto=confirm('શું આ Child માટે ફોટો પણ ઉમેરવો છે?\\n\\nOK = હા, Camera / Gallery પસંદ કરો\\nCancel = ના, ફક્ત નામ add કરો');
                let file=null;

                if(wantPhoto){
                    const input=document.createElement('input');
                    input.type='file';
                    input.accept='image/*';
                    input.style.display='none';
                    input.id='adminTreeTempPhotoInput';
                    document.body.appendChild(input);

                    const photoPromise=new Promise((resolve,reject)=>{
                        let done=false;
                        const finish=(f)=>{
                            if(done)return;
                            done=true;
                            input.removeEventListener('change',onChange);
                            if(f) resolve(f); else reject(new Error('ફોટો પસંદ કરવામાં આવ્યો નથી.'));
                        };
                        const onChange=()=>finish(input.files && input.files[0] ? input.files[0] : null);
                        input.addEventListener('change',onChange);
                        setTimeout(()=>{ if(!done){ done=true; input.removeEventListener('change',onChange); reject(new Error('Photo selection cancelled.')); } },120000);
                    });

                    if(typeof openPhotoChoice==='function'){
                        openPhotoChoice(input);
                    }else{
                        input.click();
                    }

                    try{
                        file=await photoPromise;
                    }finally{
                        input.remove();
                    }

                    if(!file) throw new Error('ફોટો પસંદ કરો.');
                    if(file.size>50*1024*1024) throw new Error('Photo maximum 50MB હોવો જોઈએ.');
                    if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)){
                        throw new Error('માત્ર image photo પસંદ કરો.');
                    }
                }

                const fd=new FormData();
                fd.append('name',name.trim());
                if(file){ file=await prepareAdminPhoto(file); fd.append('photo',file); }

                const r=await fetch('/api/admin/person/'+encodeURIComponent(parentId)+'/add',{
                    method:'POST',
                    headers:{'x-admin-key':key},
                    body:fd
                });
                const raw=await r.text(); let d; try{d=JSON.parse(raw)}catch(_){throw new Error('Server upload error ('+r.status+'). Please try again.')}
                if(!r.ok || !d.ok) throw new Error(d.error||'Member add થયો નથી');

                await viewFamily(currentFamilyId);
                await loadFamilies();

                const link=location.origin+d.addLink;
                alert('✅ '+name.trim()+' સફળતાપૂર્વક Family Tree માં add થઈ ગયો!'+(file?'\\n📷 Photo પણ save થઈ ગયો.':''));
                prompt('નવો member add થઈ ગયો. તેની link copy કરો:',link);
            }catch(e){
                if(e && e.message!=='Photo selection cancelled.')
                    alert('❌ '+e.message);
            }finally{
                if(btn){
                    btn.disabled=false;
                    btn.textContent=btn.dataset.oldText||'➕ Add Child';
                    btn.style.opacity='1';
                    btn.style.cursor='pointer';
                }
            }
        }

        
        function pickAdminPhoto(){
            return new Promise((resolve,reject)=>{
                const input=document.createElement('input');
                input.type='file'; input.accept='image/*'; input.style.display='none';
                document.body.appendChild(input);
                let done=false;
                const cleanup=()=>{input.removeEventListener('change',onChange); input.remove();};
                const finish=(file)=>{
                    if(done)return; done=true; cleanup();
                    if(file) resolve(file); else reject(new Error('Photo selection cancelled.'));
                };
                const onChange=()=>finish(input.files&&input.files[0] ? input.files[0] : null);
                input.addEventListener('change',onChange);
                if(typeof openPhotoChoice==='function') openPhotoChoice(input); else input.click();
                setTimeout(()=>{if(!done)finish(null)},120000);
            });
        }

        async function updateMemberPhoto(id){
            const p=people.find(x=>String(x._id)===String(id)); if(!p)return;
            try{
                const file=await pickAdminPhoto();
                if(!file)return;
                const cropped=await cropAdminPhoto(file);
                if(!cropped)return;
                const fd=new FormData(); fd.append('photo',cropped,'family-photo.jpg');
                const r=await fetch('/api/admin/person/'+encodeURIComponent(id)+'/photo',{
                    method:'POST',headers:{'x-admin-key':key},body:fd
                });
                const d=await r.json();
                if(!r.ok||!d.ok)throw new Error(d.error||'Photo update થઈ નથી');
                await viewFamily(currentFamilyId);
                alert('✅ '+p.name+' નો photo successfully update થઈ ગયો.');
            }catch(e){
                if(e && e.message!=='Photo selection cancelled.' && e.message!=='Crop cancelled.') alert('❌ '+e.message);
            }
        }

        async function deleteMemberPhoto(id){
            const p=people.find(x=>String(x._id)===String(id)); if(!p)return;
            if(!p.photo)return alert('આ member માટે photo નથી.');
            if(!confirm('"'+p.name+'" નો photo delete કરવો છે?'))return;
            try{
                const r=await fetch('/api/admin/person/'+encodeURIComponent(id)+'/photo',{
                    method:'DELETE',headers:{'x-admin-key':key}
                });
                const d=await r.json();
                if(!r.ok||!d.ok)throw new Error(d.error||'Photo delete થયો નથી');
                await viewFamily(currentFamilyId);
                alert('✅ '+p.name+' નો photo delete થઈ ગયો.');
            }catch(e){alert('❌ '+e.message);}
        }

async function editName(id){
            const p=people.find(x=>String(x._id)===String(id)); if(!p)return;
            const name=prompt('નવું નામ:',p.name); if(name===null||!name.trim()||name.trim()===p.name)return;
            const box=$('treebox');
            const savedLeft=box?box.scrollLeft:0, savedTop=box?box.scrollTop:0;
            const pageX=window.scrollX, pageY=window.scrollY;
            try{
                const r=await fetch('/api/admin/person/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json','x-admin-key':key},body:JSON.stringify({name:name.trim()})});
                const d=await r.json(); if(!r.ok||!d.ok)return alert(d.error||'Name update થઈ નથી');
                await viewFamily(currentFamilyId);
                requestAnimationFrame(()=>{
                    window.scrollTo(pageX,pageY);
                    const b=$('treebox'); if(b){b.scrollLeft=savedLeft;b.scrollTop=savedTop;}
                });
            }catch(e){alert('Name update error: '+e.message);}
        }

        async function deleteMember(id){
            const p=people.find(x=>String(x._id)===String(id)); if(!p)return;
            if(!confirm('"'+p.name+'" અને તેની નીચેની આખી branch delete કરવી છે?'))return;
            try{
                const r=await fetch('/api/admin/person/'+encodeURIComponent(id),{method:'DELETE',headers:{'x-admin-key':key}}); const d=await r.json();
                if(!r.ok||!d.ok)return alert(d.error||'Member delete થયો નથી');
                await viewFamily(currentFamilyId); await loadFamilies();
            }catch(e){alert('Member delete error: '+e.message);}
        }

        function avatar(n){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e7edf5"/><text x="50" y="62" text-anchor="middle" font-size="42" font-family="Arial" font-weight="700" fill="#61758e">${(n||'?')[0].toUpperCase()}</text></svg>`);}
        function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
        function escAttr(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
        function drawRealTreeStructure(){
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
    function queueRealTreePhotoRedraw(){if(realPhotoRedrawQueued)return;realPhotoRedrawQueued=true;requestAnimationFrame(()=>{realPhotoRedrawQueued=false;if(document.body.classList.contains('real-tree-open')||document.getElementById('viewer')?.classList.contains('real-tree-open'))drawRealTreeStructure();});}
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

        async function toggleRealTreeView(){
    const viewer=$('viewer'), btn=$('realTreeBtn');
    if(!viewer) return;

    const opening=!viewer.classList.contains('real-tree-open');

    if(opening){
        viewer.classList.add('real-tree-open');

        if(btn){
            btn.textContent='✕ Close Tree View';
            btn.classList.add('real-tree-close');
        }

        document.body.style.overflow='hidden';
        treeZoom=1;

        setTimeout(()=>{
            drawRealTreeStructure();
        },80);

    }else{
        viewer.classList.remove('real-tree-open');

        const realCanvas=$('realTreeCanvas');
        if(realCanvas) realCanvas.remove();

        const layer=$('treeLayer');
        if(layer){
            layer.classList.remove('real-natural-tree');
            layer.style.width='';
            layer.style.height='';
            layer.style.minWidth='';
            layer.style.minHeight='';
            layer.style.transform='scale(1)';
        }

        const treebox=$('treebox');
        if(treebox){
            treebox.style.height='';
            treebox.style.minHeight='';
            treebox.style.maxHeight='';
            treebox.style.overflow='';
            treebox.style.webkitOverflowScrolling='';
            treebox.scrollTop=0;
            treebox.scrollLeft=0;
        }

        const oldSvg=$('svg');
        if(oldSvg) oldSvg.style.display='';

        const cards=$('cards');
        if(cards) cards.style.display='';

        if(btn){
            btn.textContent='🌳 Real Tree View';
            btn.classList.remove('real-tree-close');
        }

        document.body.style.overflow='';
        renderTree();
    }
}

async function loadHtml2Canvas(){
            if(window.html2canvas) return;
            const s=document.createElement('script');
            s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            document.head.appendChild(s);
            await new Promise((resolve,reject)=>{s.onload=resolve;s.onerror=reject;});
        }

        async function loadJsPDF(){
            if(window.jspdf && window.jspdf.jsPDF) return;
            const s=document.createElement('script');
            s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
            document.head.appendChild(s);
            await new Promise((resolve,reject)=>{s.onload=resolve;s.onerror=reject;});
        }

        async function downloadTreePDF(){
            if(!people.length) return alert('પહેલા Family Tree ખોલો.');
            const btns=[...document.querySelectorAll('.tree-card-actions,.links-panel')];
            const oldDisplay=btns.map(el=>el.style.display);
            try{
                await loadHtml2Canvas();
                await loadJsPDF();
                btns.forEach(el=>el.style.display='none');
                const oldZoom=treeZoom;
                treeZoom=1; applyTreeZoom();
                await new Promise(r=>setTimeout(r,150));
                const node=$('canvas');
                const imageCanvas=await html2canvas(node,{scale:1.5,backgroundColor:'#fbfcfe',useCORS:true,allowTaint:true,logging:false});
                const {jsPDF}=window.jspdf;
                const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
                const pageW=pdf.internal.pageSize.getWidth(), pageH=pdf.internal.pageSize.getHeight();
                const margin=8, maxW=pageW-margin*2, maxH=pageH-margin*2;
                const ratio=Math.min(maxW/imageCanvas.width,maxH/imageCanvas.height);
                const w=imageCanvas.width*ratio, h=imageCanvas.height*ratio;
                pdf.addImage(imageCanvas.toDataURL('image/jpeg',0.92),'JPEG',(pageW-w)/2,(pageH-h)/2,w,h);
                pdf.save('family-tree.pdf');
                treeZoom=oldZoom; applyTreeZoom();
            }catch(e){alert('PDF download error: '+e.message);}
            finally{btns.forEach((el,i)=>el.style.display=oldDisplay[i]);}
        }

        async function downloadPNG(){
            if(!people.length)return;
            await loadHtml2Canvas();
            const c=await html2canvas($('canvas'),{scale:2,backgroundColor:'#fbfcfe',useCORS:true});
            const a=document.createElement('a');a.download='family-tree-admin.png';a.href=c.toDataURL('image/png');a.click();
        }

        (async function restoreAdminSession(){
            if(!key)return;
            const ok=await checkAdmin();
            if(ok){showAdminApp();await loadFamilies();}else{localStorage.removeItem('adminKey');key='';showLogin();}
        })();
    

let photoChoiceTargetInput = null;

function openPhotoChoice(input){
  photoChoiceTargetInput = input || null;
  const o=document.getElementById('photoChoiceOverlay');
  if(o)o.classList.add('show');
}
function closePhotoChoice(){
  const o=document.getElementById('photoChoiceOverlay');
  if(o)o.classList.remove('show');
  photoChoiceTargetInput=null;
}
function forwardPhoto(file){
  if(!photoChoiceTargetInput || !file){ closePhotoChoice(); return; }
  const dt=new DataTransfer();
  dt.items.add(file);
  photoChoiceTargetInput.files=dt.files;
  photoChoiceTargetInput.dispatchEvent(new Event('change',{bubbles:true}));
  closePhotoChoice();
}
function chooseCamera(){
  const i=document.getElementById('photoCameraInput');
  i.value='';
  i.onchange=()=>forwardPhoto(i.files && i.files[0]);
  i.click();
}
function chooseGallery(){
  const i=document.getElementById('photoGalleryInput');
  i.value='';
  i.onchange=()=>forwardPhoto(i.files && i.files[0]);
  i.click();
}


function openPhotoChoice(input){
  photoChoiceTargetInput=input||null;
  const o=document.getElementById('photoChoiceOverlay');
  if(o)o.classList.add('show');
}
function closePhotoChoice(){
  const o=document.getElementById('photoChoiceOverlay');
  if(o)o.classList.remove('show');
  photoChoiceTargetInput=null;
}
function forwardPhoto(file){
  if(!photoChoiceTargetInput||!file){closePhotoChoice();return;}
  try{
    const dt=new DataTransfer();
    dt.items.add(file);
    photoChoiceTargetInput.files=dt.files;
    photoChoiceTargetInput.dispatchEvent(new Event('change',{bubbles:true}));
  }catch(e){}
  closePhotoChoice();
}
function chooseCamera(){
  const i=document.getElementById('photoCameraInput');
  i.value='';
  i.onchange=()=>forwardPhoto(i.files&&i.files[0]);
  i.click();
}
function chooseGallery(){
  const i=document.getElementById('photoGalleryInput');
  i.value='';
  i.onchange=()=>forwardPhoto(i.files&&i.files[0]);
  i.click();
}


let cropState=null;

function openPhotoCrop(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const overlay=document.getElementById('photoCropOverlay');
      const canvas=document.getElementById('photoCropCanvas');
      const stage=document.querySelector('.photo-crop-stage');
      cropState={img,canvas,stage,zoom:1,x:0,y:0,startX:0,startY:0,dragging:false,resolve,reject};
      document.getElementById('photoCropZoom').value=1;
      overlay.classList.add('show');
      drawPhotoCrop();
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Invalid photo'))};
    img.src=url;
  });
}
function drawPhotoCrop(){
  if(!cropState)return;
  const {img,canvas}=cropState, ctx=canvas.getContext('2d'), S=canvas.width;
  ctx.clearRect(0,0,S,S); ctx.fillStyle='#111';ctx.fillRect(0,0,S,S);
  const base=Math.max(S/img.naturalWidth,S/img.naturalHeight);
  const scale=base*cropState.zoom;
  const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  const cx=S/2+cropState.x,cy=S/2+cropState.y;
  ctx.drawImage(img,cx-w/2,cy-h/2,w,h);
}
function cropSetZoom(v){if(!cropState)return;cropState.zoom=Math.max(1,Math.min(3,Number(v)||1));drawPhotoCrop()}
function cropZoom(d){if(!cropState)return;cropSetZoom(cropState.zoom+d);document.getElementById('photoCropZoom').value=cropState.zoom}
function closeCrop(){const o=document.getElementById('photoCropOverlay');if(o)o.classList.remove('show')}
function cancelPhotoCrop(){if(!cropState)return;const r=cropState.reject;cropState=null;closeCrop();r(new Error('Crop cancelled.'))}
function applyPhotoCrop(){
  if(!cropState)return;
  const s=cropState, src=s.canvas, out=document.createElement('canvas'); out.width=800;out.height=800;
  const o=out.getContext('2d'); const ratio=800/src.width;
  o.drawImage(src,0,0,800,800);
  out.toBlob(blob=>{
    if(!blob){const r=s.reject;cropState=null;closeCrop();r(new Error('Crop failed.'));return}
    const r=s.resolve;cropState=null;closeCrop();r(new File([blob],'family-photo.jpg',{type:'image/jpeg'}));
  },'image/jpeg',.92);
}
function cropPointerStart(e){
  if(!cropState)return;cropState.dragging=true;cropState.startX=e.clientX-cropState.x;cropState.startY=e.clientY-cropState.y;
  e.currentTarget.setPointerCapture?.(e.pointerId);
}
function cropPointerMove(e){
  if(!cropState||!cropState.dragging)return;
  cropState.x=e.clientX-cropState.startX;cropState.y=e.clientY-cropState.startY;
  const S=cropState.canvas.width, max=S*.7;
  cropState.x=Math.max(-max,Math.min(max,cropState.x));cropState.y=Math.max(-max,Math.min(max,cropState.y));drawPhotoCrop();
}
function cropPointerEnd(){if(cropState)cropState.dragging=false}
(function(){
  const c=document.getElementById('photoCropCanvas');
  if(c){c.addEventListener('pointerdown',cropPointerStart);c.addEventListener('pointermove',cropPointerMove);c.addEventListener('pointerup',cropPointerEnd);c.addEventListener('pointercancel',cropPointerEnd)}
})();
function cropAdminPhoto(file){return openPhotoCrop(file)}

/* Every Camera/Gallery selection now goes through the round cropper first. */
function forwardPhoto(file){
  const target=photoChoiceTargetInput;
  closePhotoChoice();
  if(!target||!file){
    if(target){try{target.value='';target.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}}
    return;
  }
  openPhotoCrop(file).then(cropped=>{
    try{
      const dt=new DataTransfer();dt.items.add(cropped);target.files=dt.files;
      target.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(e){}
  }).catch(()=>{
    try{target.value='';target.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}
  });
}


function adminTreeAddChild(parentId){
  if(typeof window.addChild==='function'){ window.addChild(parentId); return; }
  if(typeof window.openAddChild==='function'){ window.openAddChild(parentId); return; }
  if(typeof window.showAddChild==='function'){ window.showAddChild(parentId); return; }
  alert('Add Child form તૈયાર નથી.');
}
        initTreeZoomTouch();
