
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


/* ===== FAMILY TREE FIT-TO-SCREEN JS ===== */
(function () {
  function findFirst(selectors) {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function fitFamilyTreeToScreen() {
    const viewport = findFirst([
      '.tree-viewport', '.tree-scroll', '.tree-wrapper',
      '#treeViewport', '#treeScroll', '#treeContainer'
    ]);
    const canvas = findFirst([
      '.tree-canvas', '.tree-content', '#treeCanvas', '#treeContent',
      '.family-tree', '.tree'
    ]);
    if (!viewport || !canvas) return;

    // Remove previous transform before measuring.
    canvas.style.transform = 'none';

    // Fit horizontally only when needed. Keep cards readable.
    const vw = Math.max(1, viewport.clientWidth - 16);
    const cw = Math.max(1, canvas.scrollWidth);
    let scale = 1;
    if (cw > vw) scale = Math.max(0.72, Math.min(1, vw / cw));

    canvas.style.transformOrigin = '50% 100%';
    canvas.style.transform = 'scale(' + scale + ')';

    // Keep the actual tree visually anchored at the bottom.
    viewport.scrollTop = viewport.scrollHeight;
  }

  window.fitFamilyTreeToScreen = fitFamilyTreeToScreen;
  window.addEventListener('resize', function () {
    clearTimeout(window.__treeFitTimer);
    window.__treeFitTimer = setTimeout(fitFamilyTreeToScreen, 80);
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(fitFamilyTreeToScreen, 250);
  });
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(fitFamilyTreeToScreen, 120);
    setTimeout(fitFamilyTreeToScreen, 500);
  });

  // If the app redraws the tree dynamically, refit after DOM changes.
  const observer = new MutationObserver(function () {
    clearTimeout(window.__treeMutationTimer);
    window.__treeMutationTimer = setTimeout(fitFamilyTreeToScreen, 80);
  });
  window.addEventListener('load', function () {
    const target = findFirst([
      '.tree-viewport', '.tree-scroll', '#treeViewport', '#treeScroll',
      '#treeContainer', '.tree-container'
    ]);
    if (target) observer.observe(target, { childList: true, subtree: true });
  });
})();
