from pathlib import Path
p=Path('/mnt/data/realfix/public/admin.html')
s=p.read_text(encoding='utf-8')
start=s.index('        function drawRealTreeStructure(){')
end=s.index('        async function toggleRealTreeView(){', start)
new=r'''        function drawRealTreeStructure(){
            const layer=$('treeLayer'), oldSvg=$('svg'), canvas=$('canvas');
            if(!layer||!canvas||!people.length)return;
            layer.classList.add('real-natural-tree');

            // Real Tree View uses a dedicated HTML canvas. This keeps the natural trunk/branches
            // completely independent from the normal family-tree SVG connector CSS.
            let tc=$('realTreeCanvas');
            if(!tc){
                tc=document.createElement('canvas');
                tc.id='realTreeCanvas';
                layer.appendChild(tc);
            }
            if(oldSvg) oldSvg.style.display='none';
            const cards=$('cards'); if(cards)cards.style.display='none';

            const kids=new Map();
            people.forEach(p=>{
                if(!p.parentId)return;
                const id=String(p.parentId);
                if(!kids.has(id))kids.set(id,[]);
                kids.get(id).push(p);
            });
            kids.forEach(a=>a.sort((a,b)=>(Number(a.generation)||0)-(Number(b.generation)||0)));
            const root=people.find(p=>!p.parentId)||people.slice().sort((a,b)=>(Number(a.generation)||1)-(Number(b.generation)||1))[0];
            if(!root)return;

            const gen=p=>Number(p.generation)||1;
            const maxGen=Math.max(...people.map(gen),1);
            const BASE_GAP=185;
            const MIN_SPREAD=170;
            const MAX_SPREAD=360;
            const worldH=Math.max(1550, maxGen*230+430);

            // Calculate a natural width for each family branch.
            const memo=new Map();
            function width(p){
                const id=String(p._id); if(memo.has(id))return memo.get(id);
                const a=kids.get(id)||[];
                if(!a.length){memo.set(id,150);return 150;}
                const w=a.reduce((sum,c)=>sum+width(c),0)+BASE_GAP*(a.length-1);
                memo.set(id,Math.max(230,w)); return memo.get(id);
            }
            const worldW=Math.max(1900,Math.min(9000,width(root)+520));
            const pos=new Map();
            function place(p,x,y){
                pos.set(String(p._id),{x,y});
                const a=kids.get(String(p._id))||[]; if(!a.length)return;
                const total=a.reduce((sum,c)=>sum+width(c),0)+BASE_GAP*(a.length-1);
                let cur=x-total/2;
                a.forEach(c=>{const w=width(c);place(c,cur+w/2,y-210);cur+=w+BASE_GAP;});
            }
            place(root,worldW/2,worldH-250);

            // Canvas is deliberately larger than the viewport so zoom/pan works exactly like the normal tree.
            const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
            tc.width=Math.round(worldW*dpr); tc.height=Math.round(worldH*dpr);
            tc.style.width=worldW+'px'; tc.style.height=worldH+'px';
            tc.style.position='absolute'; tc.style.left='0'; tc.style.top='0'; tc.style.zIndex='6';
            tc.style.display='block'; tc.style.visibility='visible'; tc.style.pointerEvents='none';
            layer.style.width=worldW+'px'; layer.style.height=worldH+'px';
            canvas.style.width=worldW+'px'; canvas.style.height=worldH+'px';
            canvas.dataset.baseWidth=worldW; canvas.dataset.baseHeight=worldH;
            layer.style.transform='scale('+treeZoom+')'; updateTreeZoomLabel();

            const ctx=tc.getContext('2d');
            ctx.setTransform(dpr,0,0,dpr,0,0);
            ctx.clearRect(0,0,worldW,worldH);

            // Sky, distant hills and grass: a clean natural backdrop.
            const sky=ctx.createLinearGradient(0,0,0,worldH);
            sky.addColorStop(0,'#7fc8ec'); sky.addColorStop(.58,'#dff1d3'); sky.addColorStop(1,'#6ea84d');
            ctx.fillStyle=sky; ctx.fillRect(0,0,worldW,worldH);
            ctx.fillStyle='rgba(255,255,255,.34)';
            [[.12,.16,150],[.78,.13,180],[.52,.08,110]].forEach(([rx,ry,r])=>{ctx.beginPath();ctx.arc(worldW*rx,worldH*ry,r,0,Math.PI*2);ctx.fill();});
            ctx.fillStyle='#75a957'; ctx.beginPath();ctx.moveTo(0,worldH-360);for(let x=0;x<=worldW;x+=120)ctx.quadraticCurveTo(x+60,worldH-430+(x%240),x+120,worldH-360);ctx.lineTo(worldW,worldH);ctx.lineTo(0,worldH);ctx.fill();

            function woodGradient(x1,y1,x2,y2){
                const g=ctx.createLinearGradient(x1,y1,x2,y2);
                g.addColorStop(0,'#3a1b0c');g.addColorStop(.22,'#70401f');g.addColorStop(.45,'#c57a3c');g.addColorStop(.62,'#e0a061');g.addColorStop(.82,'#7b461f');g.addColorStop(1,'#32170a');return g;
            }
            function curve(x1,y1,cx1,cy1,cx2,cy2,x2,y2,width){
                ctx.save();ctx.beginPath();ctx.moveTo(x1,y1);ctx.bezierCurveTo(cx1,cy1,cx2,cy2,x2,y2);
                ctx.strokeStyle=woodGradient(x1,y1,x2,y2);ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
                ctx.strokeStyle='rgba(239,166,94,.52)';ctx.lineWidth=Math.max(2,width*.14);ctx.beginPath();ctx.moveTo(x1-width*.05,y1);ctx.bezierCurveTo(cx1-width*.04,cy1-2,cx2-width*.04,cy2-2,x2-width*.02,y2-2);ctx.stroke();ctx.restore();
            }
            function bark(x1,y1,cx1,cy1,cx2,cy2,x2,y2){
                ctx.save();ctx.strokeStyle='rgba(55,25,10,.34)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x1,y1);ctx.bezierCurveTo(cx1,cy1,cx2,cy2,x2,y2);ctx.stroke();ctx.restore();
            }
            function leaves(x,y,count=16,scale=1){
                for(let i=0;i<count;i++){
                    const a=(i/count)*Math.PI*2+(i%3)*.17, r=18+(i%5)*10;
                    const lx=x+Math.cos(a)*r,ly=y+Math.sin(a)*r*.7;
                    ctx.save();ctx.translate(lx,ly);ctx.rotate(a+.35);ctx.fillStyle=['#2e7d32','#4f9d3f','#74b84d','#9dcc59'][i%4];
                    ctx.beginPath();ctx.ellipse(0,0,11*scale,6*scale,0,0,Math.PI*2);ctx.fill();ctx.restore();
                }
            }
            function plaque(p,x,y){
                const name=String(p.name||'').trim(); if(!name)return;
                const label=name.length>26?name.slice(0,25)+'…':name;
                ctx.save();ctx.font='bold 18px "Noto Sans Gujarati", Arial, sans-serif';
                const w=Math.max(150,Math.min(280,ctx.measureText(label).width+38)),h=58;
                ctx.fillStyle='#d79a59';ctx.strokeStyle='#5c3218';ctx.lineWidth=4;
                ctx.shadowColor='rgba(40,20,5,.35)';ctx.shadowBlur=10;ctx.shadowOffsetY=5;
                ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,13);ctx.fill();ctx.stroke();
                ctx.shadowColor='transparent';ctx.fillStyle='#30180b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y-5);
                ctx.font='bold 12px Arial';ctx.fillStyle='#633518';ctx.fillText('Generation '+gen(p),x,y+18);ctx.restore();
            }

            const baseX=pos.get(String(root._id)).x, baseY=worldH-80, crownY=pos.get(String(root._id)).y+80;
            // Massive central trunk with flared base.
            curve(baseX-105,baseY,baseX-150,baseY-120,baseX-125,crownY+150,baseX-45,crownY,190);
            curve(baseX+105,baseY,baseX+150,baseY-120,baseX+125,crownY+150,baseX+45,crownY,190);
            curve(baseX,baseY,baseX-35,baseY-240,baseX-22,crownY+60,baseX,crownY-5,120);
            for(let i=-6;i<=6;i++)bark(baseX+i*15,baseY,baseX+i*18,baseY-210,baseX+i*8,crownY+50,baseX+i*4,crownY-20);

            // Roots.
            for(let i=-9;i<=9;i++){
                if(!i)continue; const dir=i<0?-1:1, len=100+Math.abs(i)*38;
                curve(baseX+dir*25,baseY-25,baseX+dir*85,baseY+5,baseX+dir*len*.8,baseY+40,baseX+dir*len,baseY+70,Math.max(7,20-Math.abs(i)));
            }

            // Every parent -> child becomes a genuine wooden branch. The last generation also gets a twig.
            function drawFamily(p){
                const pp=pos.get(String(p._id)); if(!pp)return;
                const a=kids.get(String(p._id))||[];
                if(!a.length){
                    const dir=(Math.round(pp.x)%2?1:-1), tw=65;
                    curve(pp.x,pp.y+12,pp.x+dir*25,pp.y-25,pp.x+dir*48,pp.y-55,pp.x+dir*78,pp.y-88,8);
                    leaves(pp.x+dir*84,pp.y-95,16,1); plaque(p,pp.x,pp.y+70); return;
                }
                const parentGen=gen(p), mainW=Math.max(12,46-(parentGen-1)*4);
                a.forEach((c,i)=>{
                    const cp=pos.get(String(c._id)); if(!cp)return;
                    const dir=cp.x>=pp.x?1:-1, dx=Math.abs(cp.x-pp.x);
                    const sx=pp.x+dir*Math.min(75,Math.max(25,dx*.10)), sy=pp.y-8;
                    const ex=cp.x, ey=cp.y+28;
                    const bend=Math.max(90,Math.min(250,dx*.38));
                    curve(sx,sy,sx+dir*bend,sy-120,ex-dir*bend,ey+95,ex,ey,mainW);
                    // secondary side twig + foliage, like a real spreading tree.
                    const side= i%2===0?1:-1;
                    curve(ex,ey,ex+side*35,ey-42,ex+side*70,ey-62,ex+side*98,ey-105,Math.max(6,mainW*.28));
                    leaves(ex+side*105,ey-112,13,.9);
                    plaque(c,(pp.x+ex)/2,(sy+ey)/2-28);
                    drawFamily(c);
                });
            }

            // Main crown branches start from the trunk and fan out to generation 2.
            const first=kids.get(String(root._id))||[];
            first.forEach((c,i)=>{
                const cp=pos.get(String(c._id)); if(!cp)return;
                const dir=cp.x>=baseX?1:-1, dx=Math.abs(cp.x-baseX);
                curve(baseX, crownY+20, baseX+dir*Math.min(220,dx*.35), crownY-110, cp.x-dir*Math.min(260,dx*.30), cp.y+150, cp.x,cp.y+28,58);
                leaves(cp.x-dir*25,cp.y-30,20,1.05);
                plaque(c,(baseX+cp.x)/2,crownY-80);
                drawFamily(c);
            });
            plaque(root,baseX,crownY+100);
            leaves(baseX-250,crownY-120,22,1.15); leaves(baseX+250,crownY-120,22,1.15);
        }

'''
s=s[:start]+new+s[end:]
# Replace real tree CSS with a simpler guaranteed canvas layer. Keep existing styles but append overrides.
marker='        .canvas {\n'
css=r'''        /* Final Real Tree renderer: canvas is above the old SVG and below controls. */
        .real-tree-open #treeLayer.real-natural-tree{position:relative!important;overflow:visible!important;background:transparent!important;}
        .real-tree-open #treeLayer.real-natural-tree #realTreeCanvas{display:block!important;visibility:visible!important;opacity:1!important;z-index:50!important;position:absolute!important;left:0!important;top:0!important;pointer-events:none!important;}
        .real-tree-open #treeLayer.real-natural-tree #svg{display:none!important;visibility:hidden!important;}
        .real-tree-open #treeLayer.real-natural-tree #cards{display:none!important;visibility:hidden!important;}
        .real-tree-open #treeLayer.real-natural-tree::after{display:none!important;}
'''
s=s.replace(marker,css+marker,1)
p.write_text(s,encoding='utf-8')
