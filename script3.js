
function adminTreeAddChild(parentId){
  if(typeof window.addChild==='function'){ window.addChild(parentId); return; }
  if(typeof window.openAddChild==='function'){ window.openAddChild(parentId); return; }
  if(typeof window.showAddChild==='function'){ window.showAddChild(parentId); return; }
  alert('Add Child form તૈયાર નથી.');
}
        initTreeZoomTouch();
