
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
