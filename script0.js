
        let key = localStorage.getItem('adminKey') || '';
        let people = [];
        let currentFamilyId = '';
        let treeZoom=1; let pinchStartDistance=0; let pinchStartZoom=1;
        const $ = id => document.getElementById(id);

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

        async function deleteFamily(id){
            if(!confirm('આ Family ની આખી Tree અને બધા members કાયમ માટે delete કરવાના છે?'))return;
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
            const cards=$('cards'), svg=$('svg'), canvas=$('canvas');
            cards.innerHTML=''; svg.innerHTML='';
            if(!people.length){cards.innerHTML='<div class="empty">આ Family માં member નથી.</div>';return;}
            const byId=new Map(people.map(p=>[String(p._id),p]));
            const children=new Map();
            people.forEach(p=>{const pid=p.parentId?String(p.parentId):'root'; if(!children.has(pid))children.set(pid,[]); children.get(pid).push(p);});
            children.forEach(a=>a.sort((x,y)=>(x.generation-y.generation)||new Date(x.createdAt)-new Date(y.createdAt)));
            const root=people.find(p=>!p.parentId)||people.slice().sort((a,b)=>a.generation-b.generation)[0];
            if(!root){return;}

            const CARD_W=210, CARD_H=245, H_GAP=38, V_GAP=95, PAD_X=80, PAD_Y=50;
            const widths=new Map();
            function width(id){
                id=String(id); if(widths.has(id))return widths.get(id);
                const kids=children.get(id)||[];
                const w=kids.length?kids.reduce((sum,k)=>sum+width(k._id),0)+H_GAP*(kids.length-1):CARD_W;
                widths.set(id,w); return w;
            }
            const positions=new Map();
            function place(node,cx,y){
                const id=String(node._id), kids=children.get(id)||[], w=width(id);
                const left=cx-w/2;
                positions.set(id,{x:cx-CARD_W/2,y,w});
                if(kids.length){
                    let cur=left;
                    kids.forEach(k=>{const kw=width(k._id);place(k,cur+kw/2,y+CARD_H+V_GAP);cur+=kw+H_GAP;});
                }
            }
            place(root,PAD_X+width(root._id)/2,PAD_Y);
            const all=[...positions.values()];
            const maxX=Math.max(1100,...all.map(q=>q.x+CARD_W+PAD_X));
            const maxY=Math.max(900,...all.map(q=>q.y+CARD_H+PAD_Y));
            canvas.dataset.baseWidth=maxX; canvas.dataset.baseHeight=maxY; applyTreeZoom(maxX,maxY);
            svg.setAttribute('width',maxX); svg.setAttribute('height',maxY);

            const localized={};
            people.forEach(p=>{localized[String(p._id)]=p.name});
            people.forEach(p=>{
                const q=positions.get(String(p._id)); if(!q)return;
                const d=document.createElement('div'); d.className='card'; d.dataset.personId=String(p._id); d.dataset.personName=(p.name||'').toLowerCase(); d.style.left=q.x+'px'; d.style.top=q.y+'px';
                const shown=localized[String(p._id)]||p.name;
                d.innerHTML=`<img src="${esc(p.photo||avatar(shown))}" alt=""><b>${esc(shown)}</b><small>Generation ${p.generation}</small><div class="tree-card-actions"><button type="button" class="btn" onclick="adminAddChild('${escAttr(p._id)}','${escAttr(p.name)}',this)">➕ Add</button><button type="button" class="btn" onclick="openAdminMemberLink('${escAttr(p.addToken)}')">🔗 Open Link</button><button type="button" class="btn danger" onclick="deleteMember('${escAttr(p._id)}')">🗑️ Delete</button></div>`;
                d.onpointerdown=e=>{if(e.target.closest('button,input,a'))e.stopPropagation()};cards.appendChild(d);
            });

            // Card-to-card joined connectors: every line touches the exact bottom/top edge.
            // For multiple children, one horizontal bus joins all child branches.
            const grouped=new Map();
            people.forEach(p=>{
                if(!p.parentId)return;
                const pid=String(p.parentId);
                if(!grouped.has(pid))grouped.set(pid,[]);
                grouped.get(pid).push(p);
            });
            grouped.forEach((kids,pid)=>{
                const parent=positions.get(pid);
                if(!parent)return;
                const px=parent.x+CARD_W/2, py=parent.y+CARD_H;
                const childData=kids.map(k=>positions.get(String(k._id))).filter(Boolean);
                if(!childData.length)return;
                const childY=childData[0].y;
                const busY=py+(childY-py)/2;
                const xs=childData.map(q=>q.x+CARD_W/2);
                const minX=Math.min(...xs), maxX=Math.max(...xs);
                drawLine(svg,px,py,px,busY);
                if(childData.length>1) drawLine(svg,minX,busY,maxX,busY);
                childData.forEach(q=>drawLine(svg,q.x+CARD_W/2,busY,q.x+CARD_W/2,childY));
            });
            renderMemberLinks();
        }

        function drawLine(svg,x1,y1,x2,y2){
            const ns='http://www.w3.org/2000/svg',p=document.createElementNS(ns,'path');
            p.setAttribute('d',`M${x1} ${y1} L${x2} ${y2}`);
            p.setAttribute('fill','none');
            p.setAttribute('stroke','#64748b');
            p.setAttribute('stroke-width','5');
            p.setAttribute('stroke-linecap','butt');
            p.setAttribute('stroke-linejoin','miter');
            svg.appendChild(p);
        }

        function updateTreeZoomLabel(){const el=$('treeZoomLabel');if(el)el.textContent=Math.round(treeZoom*100)+'%'}
        function applyTreeZoom(baseW,baseH){const canvas=$('canvas'),layer=$('treeLayer');if(!canvas||!layer)return;const w=Number(baseW||canvas.dataset.baseWidth||canvas.offsetWidth||1000),h=Number(baseH||canvas.dataset.baseHeight||canvas.offsetHeight||900);canvas.dataset.baseWidth=w;canvas.dataset.baseHeight=h;canvas.style.width=(w*treeZoom)+'px';canvas.style.height=(h*treeZoom)+'px';layer.style.width=w+'px';layer.style.height=h+'px';layer.style.transform='scale('+treeZoom+')';updateTreeZoomLabel()}
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
                item.innerHTML=`<div class="name">${esc(localized[String(p._id)]||p.name)}</div><small>Generation ${p.generation}</small><input class="member-link" value="${esc(link)}" readonly><div class="tool-row"><button class="btn" onclick="copyLink('${escAttr(link)}')">🔗 Copy Link</button><button class="btn" onclick="adminAddChild('${escAttr(p._id)}','${escAttr(p.name)}',this)">➕ Add Child</button><button class="btn gray" onclick="editName('${escAttr(p._id)}')">✏️ Name</button><button class="btn danger" onclick="deleteMember('${escAttr(p._id)}')">🗑️ Delete</button></div>`;
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

        async function editName(id){
            const p=people.find(x=>String(x._id)===String(id)); if(!p)return;
            const name=prompt('નવું નામ:',p.name); if(name===null||!name.trim()||name.trim()===p.name)return;
            try{
                const r=await fetch('/api/admin/person/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json','x-admin-key':key},body:JSON.stringify({name:name.trim()})});
                const d=await r.json(); if(!r.ok||!d.ok)return alert(d.error||'Name update થઈ નથી');
                await viewFamily(currentFamilyId);
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
    if(normalSvg) normalSvg.style.display = 'none';

    const cards = $('cards');
    if(cards) cards.style.display = 'none';

    let tc = $('realTreeCanvas');
    if(!tc){
        tc = document.createElement('canvas');
        tc.id = 'realTreeCanvas';
        layer.appendChild(tc);
    }

    const children = new Map();
    people.forEach(p=>{
        const pid = p.parentId ? String(p.parentId) : '';
        if(!children.has(pid)) children.set(pid, []);
        children.get(pid).push(p);
    });

    const generation = p => Number(p.generation) || 1;

    /* Find the real root. If several generation-1 people exist,
       use the first parentless person as the trunk owner. */
    const root =
        people.find(p => !p.parentId) ||
        people.slice().sort((a,b)=>generation(a)-generation(b))[0];

    if(!root) return;

    children.forEach(list=>{
        list.sort((a,b)=>
            String(a.name||'').localeCompare(String(b.name||''), 'gu')
        );
    });

    const maxGen = Math.max(...people.map(generation), 1);

    /*
      Natural tree layout:
      - root at the bottom
      - every generation moves upward
      - every child gets its own branch
      - subtree widths keep siblings separated
    */
    const levelGap = Math.max(245, Math.min(310, 275 + maxGen*4));
    const leafGap = 250;

    const subtree = new Map();

    function measure(p){
        const id = String(p._id);
        if(subtree.has(id)) return subtree.get(id);

        const kids = children.get(id) || [];
        if(!kids.length){
            subtree.set(id, leafGap);
            return leafGap;
        }

        let total = 0;
        kids.forEach((c,i)=>{
            total += measure(c);
            if(i < kids.length-1) total += 75;
        });

        total = Math.max(total, leafGap);
        subtree.set(id,total);
        return total;
    }

    measure(root);

    const treeWidth = Math.max(
        1800,
        Math.min(10000, subtree.get(String(root._id)) + 700)
    );

    const treeHeight = Math.max(
        1900,
        620 + maxGen * levelGap
    );

    const pos = new Map();

    function place(p, x){
        const g = generation(p);
        const y = treeHeight - 250 - (g-1)*levelGap;

        pos.set(String(p._id), {x,y});

        const kids = children.get(String(p._id)) || [];
        if(!kids.length) return;

        let total = 0;
        kids.forEach((c,i)=>{
            total += measure(c);
            if(i < kids.length-1) total += 75;
        });

        let cursor = x - total/2;

        kids.forEach(c=>{
            const w = measure(c);
            place(c, cursor + w/2);
            cursor += w + 75;
        });
    }

    place(root, treeWidth/2);

    /* Canvas sizing */
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    tc.width = Math.round(treeWidth*dpr);
    tc.height = Math.round(treeHeight*dpr);
    tc.style.width = treeWidth + 'px';
    tc.style.height = treeHeight + 'px';
    tc.style.position = 'absolute';
    tc.style.left = '0';
    tc.style.top = '0';
    tc.style.zIndex = '2';
    tc.style.display = 'block';
    tc.style.visibility = 'visible';
    tc.style.opacity = '1';
    tc.style.pointerEvents = 'none';
    tc.style.maxWidth = 'none';
    tc.style.maxHeight = 'none';

    layer.style.width = treeWidth + 'px';
    layer.style.minWidth = treeWidth + 'px';
    layer.style.minHeight = treeHeight + 'px';
    layer.style.height = treeHeight + 'px';

    baseCanvas.style.width = treeWidth + 'px';
    baseCanvas.style.height = treeHeight + 'px';
    baseCanvas.dataset.baseWidth = treeWidth;
    baseCanvas.dataset.baseHeight = treeHeight;

    /* The whole Real Tree is one page-sized document.
       Do NOT put a second scroll box around the tree. This lets
       desktop and mobile scroll all the way to the bottom Close button. */
    const treebox = $('treebox');
    if(treebox){
        treebox.style.height = treeHeight + 'px';
        treebox.style.minHeight = treeHeight + 'px';
        treebox.style.overflow = 'visible';
    }

    layer.style.transform = 'scale(' + treeZoom + ')';
    updateTreeZoomLabel();

    const ctx = tc.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,treeWidth,treeHeight);

    /* ---------- background ---------- */
    const sky = ctx.createLinearGradient(0,0,0,treeHeight);
    sky.addColorStop(0,'#9bd8f5');
    sky.addColorStop(.48,'#dff1d0');
    sky.addColorStop(1,'#8fb65c');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,treeWidth,treeHeight);

    /* soft clouds */
    function cloud(x,y,s){
        ctx.save();
        ctx.fillStyle='rgba(255,255,255,.58)';
        [0,35,70].forEach((dx,i)=>{
            ctx.beginPath();
            ctx.arc(x+dx*s,y+(i%2?8:0),28*s,0,Math.PI*2);
            ctx.fill();
        });
        ctx.restore();
    }
    cloud(treeWidth*.16,120,1.0);
    cloud(treeWidth*.78,170,.9);

    /* ground */
    const groundY = treeHeight-115;
    ctx.fillStyle='#5f9345';
    ctx.fillRect(0,groundY,treeWidth,treeHeight-groundY);

    /* ---------- drawing helpers ---------- */
    function woodGradient(x1,y1,x2,y2){
        const g=ctx.createLinearGradient(x1,y1,x2,y2);
        g.addColorStop(0,'#35190c');
        g.addColorStop(.18,'#63361a');
        g.addColorStop(.42,'#9a5b2a');
        g.addColorStop(.58,'#c27a3d');
        g.addColorStop(.78,'#74401e');
        g.addColorStop(1,'#2d1409');
        return g;
    }

    function strokeCurve(x1,y1,c1x,c1y,c2x,c2y,x2,y2,width){
        ctx.save();

        /* dark outline */
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);
        ctx.strokeStyle='rgba(45,20,8,.30)';
        ctx.lineWidth=width+10;
        ctx.lineCap='round';
        ctx.stroke();

        /* wood */
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);
        ctx.strokeStyle=woodGradient(x1,y1,x2,y2);
        ctx.lineWidth=width;
        ctx.lineCap='round';
        ctx.stroke();

        /* natural highlight */
        ctx.beginPath();
        ctx.moveTo(x1-width*.08,y1);
        ctx.bezierCurveTo(c1x-width*.04,c1y-3,c2x-width*.04,c2y-3,x2-width*.03,y2-2);
        ctx.strokeStyle='rgba(239,174,101,.38)';
        ctx.lineWidth=Math.max(2,width*.11);
        ctx.stroke();

        ctx.restore();
    }

    function twig(x1,y1,x2,y2,width){
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.quadraticCurveTo(
            (x1+x2)/2 + 20,
            (y1+y2)/2 - 20,
            x2,y2
        );
        ctx.strokeStyle='#4b2814';
        ctx.lineWidth=width;
        ctx.lineCap='round';
        ctx.stroke();
        ctx.restore();
    }

    function leaf(x,y,rx,ry,angle,color){
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(angle);
        ctx.fillStyle=color;
        ctx.beginPath();
        ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    function foliage(x,y,scale=1){
        const colors=['#2e6e2d','#3f8736','#5da447','#78b84f','#98c95a'];
        const pts=[
            [-45,12,30,18,-.5],
            [-25,-25,35,20,-.25],
            [8,-38,38,21,.05],
            [40,-15,33,19,.35],
            [52,15,27,17,.55],
            [5,15,45,24,.1],
            [-2,-70,27,17,-.15]
        ];
        pts.forEach((p,i)=>{
            leaf(
                x+p[0]*scale,
                y+p[1]*scale,
                p[2]*scale,
                p[3]*scale,
                p[4],
                colors[i%colors.length]
            );
        });
    }

    const drawnPlaques = new Set();

    function plaque(p,x,y,small=false){
        const pid=String(p._id||'');
        if(pid && drawnPlaques.has(pid)) return;
        if(pid) drawnPlaques.add(pid);

        const name=String(p.name||'').trim();
        if(!name) return;

        ctx.save();

        const fontSize = small ? 15 : 18;
        ctx.font='800 '+fontSize+'px Arial, "Noto Sans Gujarati", sans-serif';

        const label =
            name.length>24 ? name.slice(0,23)+'…' : name;

        const w=Math.max(
            145,
            Math.min(290,ctx.measureText(label).width+42)
        );
        const h=small ? 48 : 58;

        ctx.shadowColor='rgba(30,15,5,.35)';
        ctx.shadowBlur=9;
        ctx.shadowOffsetY=5;

        ctx.fillStyle='#c98543';
        ctx.strokeStyle='#5b3218';
        ctx.lineWidth=4;

        ctx.beginPath();
        ctx.roundRect(x-w/2,y-h/2,w,h,12);
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor='transparent';

        ctx.fillStyle='#2d1609';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(label,x,y-5);

        ctx.font='700 11px Arial';
        ctx.fillStyle='#5b3218';
        ctx.fillText('Generation '+generation(p),x,y+17);

        ctx.restore();
    }

    /* ---------- roots ---------- */
    const rootPos=pos.get(String(root._id));
    const trunkBaseX=rootPos.x;
    const trunkTopY=rootPos.y+75;

    for(let i=0;i<9;i++){
        const dir=i<4?-1:(i>4?1:0);
        if(!dir) continue;

        const n=Math.abs(i-4);
        const endX=trunkBaseX+dir*(130+n*48);

        strokeCurve(
            trunkBaseX+dir*20,
            groundY+10,
            trunkBaseX+dir*60,
            groundY+20,
            endX-30*dir,
            groundY+40,
            endX,
            groundY+55,
            Math.max(7,18-n*2)
        );
    }

    /* ---------- main trunk ---------- */
    strokeCurve(
        trunkBaseX-105,
        groundY+10,
        trunkBaseX-155,
        groundY-180,
        trunkBaseX-125,
        trunkTopY+150,
        trunkBaseX-42,
        trunkTopY,
        95
    );

    strokeCurve(
        trunkBaseX+105,
        groundY+10,
        trunkBaseX+155,
        groundY-180,
        trunkBaseX+125,
        trunkTopY+150,
        trunkBaseX+42,
        trunkTopY,
        95
    );

    strokeCurve(
        trunkBaseX,
        groundY,
        trunkBaseX-35,
        groundY-260,
        trunkBaseX-28,
        trunkTopY+80,
        trunkBaseX,
        trunkTopY-5,
        105
    );

    /* bark texture */
    for(let i=-5;i<=5;i++){
        ctx.beginPath();
        ctx.moveTo(trunkBaseX+i*12,groundY-10);
        ctx.quadraticCurveTo(
            trunkBaseX+i*15,
            (groundY+trunkTopY)/2,
            trunkBaseX+i*7,
            trunkTopY+35
        );
        ctx.strokeStyle='rgba(46,21,8,.25)';
        ctx.lineWidth=3;
        ctx.stroke();
    }

    /* ---------- recursive branches ---------- */
    function drawPersonBranch(parent){
        const pp=pos.get(String(parent._id));
        if(!pp) return;

        const kids=children.get(String(parent._id))||[];

        /* Every person owns exactly one plaque.
           Root is handled separately below, so skip it here. */
        if(String(parent._id)!==String(root._id)){
            plaque(parent,pp.x,pp.y+72,false);
        }

        /* leaf generation: branch + foliage + name */
        if(!kids.length){
            const side=(pp.x>=treeWidth/2?1:-1);
            twig(
                pp.x,
                pp.y+5,
                pp.x+side*70,
                pp.y-90,
                7
            );
            foliage(pp.x+side*78,pp.y-105,.85);
            return;
        }

        kids.forEach((child,index)=>{
            const cp=pos.get(String(child._id));
            if(!cp) return;

            const dx=cp.x-pp.x;
            const side=dx>=0?1:-1;
            const distance=Math.abs(dx);

            const startY=pp.y-15;
            const endY=cp.y+28;

            const curve=Math.max(
                100,
                Math.min(300,distance*.42)
            );

            const width=Math.max(
                10,
                34-(generation(parent)-1)*4
            );

            /*
              Branch starts from parent and bends naturally
              toward the child, not as a straight line.
            */
            strokeCurve(
                pp.x,
                startY,
                pp.x+side*curve,
                startY-80,
                cp.x-side*curve*.55,
                endY+90,
                cp.x,
                endY,
                width
            );

            /*
              Side twig with leaves makes every branch
              look like a real tree rather than a diagram.
            */
            const twigSide=index%2===0?-1:1;
            const tx=cp.x+twigSide*55;
            const ty=cp.y-55;

            twig(
                cp.x,
                cp.y,
                tx,
                ty,
                Math.max(5,width*.28)
            );

            foliage(tx,ty-18,.65);

            /* The recursive call owns the child plaque.
               Drawing it here would create a duplicate card for
               every child that is also rendered as a leaf. */
            drawPersonBranch(child);
        });
    }

    /* ---------- root generation branches ---------- */
    const rootKids=children.get(String(root._id))||[];

    rootKids.forEach((child,index)=>{
        const cp=pos.get(String(child._id));
        if(!cp) return;

        const dx=cp.x-trunkBaseX;
        const side=dx>=0?1:-1;
        const distance=Math.abs(dx);

        strokeCurve(
            trunkBaseX,
            trunkTopY+25,
            trunkBaseX+side*Math.min(240,distance*.35),
            trunkTopY-150,
            cp.x-side*Math.min(300,distance*.28),
            cp.y+150,
            cp.x,
            cp.y+30,
            50
        );

        foliage(
            cp.x-side*30,
            cp.y-40,
            1
        );

        /* The recursive renderer below draws the child plaque once.
           Do not draw it here again, otherwise the child gets a double card. */
        drawPersonBranch(child);
    });

    /* Root's own name is placed inside the trunk area. */
    plaque(
        root,
        trunkBaseX,
        trunkTopY+115,
        false
    );

    /* top canopy */
    const topNodes=people.filter(p=>generation(p)===maxGen);
    topNodes.forEach(p=>{
        const pp=pos.get(String(p._id));
        if(!pp) return;
        foliage(pp.x,pp.y-125,.95);
    });
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
            treebox.style.overflow='';
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
    const oldZoom=(typeof treeZoom==='number')?treeZoom:1;
    const btns=[...document.querySelectorAll('.tree-card-actions,.links-panel')];
    const oldDisplay=btns.map(el=>el.style.display);
    let tempCanvas=null;
    try{
        await loadJsPDF();
        btns.forEach(el=>el.style.display='none');

        // Always export the REAL tree when it is open. This avoids html2canvas
        // clipping the large treebox and gives PDF a stable source image.
        const realCanvas=document.querySelector('#realTreeCanvas');
        const realOpen=document.body.classList.contains('real-tree-open');
        let sourceCanvas=realOpen ? realCanvas : null;

        if(!sourceCanvas || !(sourceCanvas.width>0 && sourceCanvas.height>0)){
            if(typeof drawRealTreeStructure==='function') drawRealTreeStructure();
            sourceCanvas=document.querySelector('#realTreeCanvas');
            if(!sourceCanvas || !(sourceCanvas.width>0 && sourceCanvas.height>0))
                throw new Error('Real Tree તૈયાર નથી. પહેલા Real Tree View ખોલો.');
        }

        // Render the tree at a safe print resolution. The full source canvas is
        // preserved, but oversized browser canvases are reduced before PDF export.
        const sw=Number(sourceCanvas.width), sh=Number(sourceCanvas.height);
        if(!Number.isFinite(sw)||!Number.isFinite(sh)||sw<2||sh<2)
            throw new Error('Tree image size invalid છે.');

        const MAX_W=3600, MAX_H=2600;
        const scale=Math.min(1,MAX_W/sw,MAX_H/sh);
        const ew=Math.max(2,Math.round(sw*scale));
        const eh=Math.max(2,Math.round(sh*scale));
        tempCanvas=document.createElement('canvas');
        tempCanvas.width=ew; tempCanvas.height=eh;
        const ctx=tempCanvas.getContext('2d',{alpha:false});
        if(!ctx) throw new Error('PDF canvas બની શક્યું નથી.');
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,ew,eh);
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='high';
        ctx.drawImage(sourceCanvas,0,0,sw,sh,0,0,ew,eh);

        const dataUrl=tempCanvas.toDataURL('image/jpeg',0.94);
        if(!dataUrl || dataUrl.length<100) throw new Error('Tree image export થઈ નથી.');

        const {jsPDF}=window.jspdf;
        // Create a large print sheet with the SAME aspect ratio as the tree.
        // This is intentional: the whole tree is kept on one PDF page and the
        // printer can scale the sheet to A3/A2/A1 without cutting branches.
        const MAX_PAGE_MM=1100;
        const MIN_PAGE_MM=250;
        const aspect=ew/eh;
        let pageW,pageH;
        if(aspect>=1){
            pageW=MAX_PAGE_MM;
            pageH=pageW/aspect;
            if(pageH<MIN_PAGE_MM){pageH=MIN_PAGE_MM; pageW=pageH*aspect;}
        }else{
            pageH=MAX_PAGE_MM;
            pageW=pageH*aspect;
            if(pageW<MIN_PAGE_MM){pageW=MIN_PAGE_MM; pageH=pageW/aspect;}
        }
        pageW=Math.min(MAX_PAGE_MM,Math.max(MIN_PAGE_MM,pageW));
        pageH=Math.min(MAX_PAGE_MM,Math.max(MIN_PAGE_MM,pageH));

        const pdf=new jsPDF({
            orientation:pageW>=pageH?'landscape':'portrait',
            unit:'mm',
            format:[pageW,pageH],
            compress:true,
            putOnlyUsedFonts:true
        });

        const margin=8;
        const maxW=Math.max(1,pageW-margin*2);
        const maxH=Math.max(1,pageH-margin*2);
        const fit=Math.min(maxW/ew,maxH/eh);
        const w=ew*fit, h=eh*fit;
        const x=(pageW-w)/2, y=(pageH-h)/2;
        if(![pageW,pageH,x,y,w,h].every(Number.isFinite)||
           pageW<=0||pageH<=0||w<=0||h<=0||
           x<0||y<0||x+w>pageW+0.01||y+h>pageH+0.01){
            throw new Error('PDF page coordinates invalid છે.');
        }

        pdf.setProperties({
            title:'Family Tree',
            subject:'Printable Family Tree',
            creator:'Family Tree'
        });
        pdf.addImage(dataUrl,'JPEG',x,y,w,h,undefined,'FAST');
        pdf.save('family-tree-print.pdf');
    }catch(e){
        console.error('PDF download error:',e);
        alert('PDF download error: '+(e&&e.message?e.message:e));
    }finally{
        btns.forEach((el,i)=>el.style.display=oldDisplay[i]);
        if(tempCanvas) tempCanvas.width=tempCanvas.height=1;
        if(typeof treeZoom==='number'){
            treeZoom=oldZoom;
            if(typeof applyTreeZoom==='function') applyTreeZoom();
        }
    }
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
    