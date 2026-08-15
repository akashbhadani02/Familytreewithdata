require("dotenv").config();
const express=require("express");
const mongoose=require("mongoose");
const path=require("path");
const multer=require("multer");
const crypto=require("crypto");

const app=express();
const MONGO_URI=process.env.MONGO_URI;
if(!MONGO_URI) console.warn("MONGO_URI is not set.");

app.use(express.json({limit:"50mb"}));
app.use(express.urlencoded({extended:true,limit:"50mb"}));
app.use(express.static(path.join(__dirname,"public")));

const storage=multer.memoryStorage();
const upload=multer({
  storage,
  limits:{fileSize:50*1024*1024},
  fileFilter:(req,file,cb)=>{ if(/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null,true); else cb(new Error('Only JPG, PNG or WEBP images are allowed.')); }
});

const PersonSchema=new mongoose.Schema({
  familyId:{type:String,index:true,required:true},
  name:{type:String,required:true,trim:true},
  parentId:{type:mongoose.Schema.Types.ObjectId,ref:"Person",default:null,index:true},
  generation:{type:Number,min:1,max:13,required:true},
  photo:{type:String,default:""},
  addToken:{type:String,unique:true,index:true},
  createdAt:{type:Date,default:Date.now}
});
const Person=mongoose.models.Person||mongoose.model("Person",PersonSchema);
const newToken=()=>crypto.randomBytes(18).toString("hex");
const photoData=(file)=>file?`data:${file.mimetype};base64,${file.buffer.toString("base64")}`:"";

let dbPromise=null;
async function connectDB(){
  if(!MONGO_URI) throw new Error("MONGO_URI environment variable is missing");
  if(mongoose.connection.readyState===1) return;
  if(!dbPromise) dbPromise=mongoose.connect(MONGO_URI,{serverSelectionTimeoutMS:10000});
  await dbPromise;
}

app.post("/api/family/start",upload.single("photo"),async(req,res)=>{
  try{
    await connectDB();
    const name=(req.body.name||"").trim();
    if(!name) return res.status(400).json({ok:false,error:"Name is required"});
    const familyId=crypto.randomBytes(7).toString("hex");
    const p=await Person.create({
      familyId,name,parentId:null,generation:1,
      photo:photoData(req.file),addToken:newToken()
    });
    res.json({ok:true,familyId,person:p,addLink:"/add/"+p.addToken});
  }catch(e){res.status(400).json({ok:false,error:e.message.includes("File too large")?"Photo is too large. Maximum 50MB allowed.":e.message})}
});

app.post("/api/add/:token",upload.single("photo"),async(req,res)=>{
  try{
    await connectDB();
    const parent=await Person.findOne({addToken:req.params.token});
    if(!parent) return res.status(404).json({ok:false,error:"This link is not valid"});
    if(parent.generation>=13) return res.status(400).json({ok:false,error:"This family tree has reached the maximum of 13 generations."});
    const name=(req.body.name||"").trim();
    if(!name) return res.status(400).json({ok:false,error:"Name is required"});
    const p=await Person.create({
      familyId:parent.familyId,name,parentId:parent._id,
      generation:parent.generation+1,photo:photoData(req.file),addToken:newToken()
    });
    res.json({ok:true,person:{_id:p._id,name:p.name,parentId:p.parentId,generation:p.generation,addToken:p.addToken},addLink:"/add/"+p.addToken});
  }catch(e){res.status(400).json({ok:false,error:e.message.includes("File too large")?"Photo is too large. Maximum 50MB allowed.":e.message})}
});

app.get("/api/add/:token",async(req,res)=>{
  try{
    await connectDB();
    const p=await Person.findOne({addToken:req.params.token}).lean();
    if(!p) return res.status(404).json({ok:false,error:"This link is not valid"});
    res.json({ok:true,parent:{name:p.name,generation:p.generation,familyId:p.familyId}});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
});

app.get("/api/family/:familyId",async(req,res)=>{
  try{
    await connectDB();
    const people=await Person.find({familyId:req.params.familyId})
      .sort({generation:1,createdAt:1}).lean();
    res.json({ok:true,people});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
});

app.delete("/api/admin/person/:id",async(req,res)=>{
  try{
    const adminKey=process.env.ADMIN_KEY || "Akashkey123";
    if(!adminKey || req.headers["x-admin-key"]!==adminKey)
      return res.status(401).json({ok:false,error:"Unauthorized"});

    await connectDB();
    const p=await Person.findById(req.params.id);
    if(!p)return res.status(404).json({ok:false,error:"Member not found"});

    // Delete this member and all of its descendants so no broken tree links remain.
    const queue=[p._id];
    const ids=[];
    while(queue.length){
      const parentId=queue.shift();
      ids.push(parentId);
      const kids=await Person.find({
        familyId:p.familyId,
        parentId
      }).select('_id').lean();
      kids.forEach(k=>queue.push(k._id));
    }

    await Person.deleteMany({_id:{$in:ids}});
    res.json({ok:true,deletedCount:ids.length});
  }catch(e){
    res.status(400).json({ok:false,error:e.message});
  }
});

app.delete("/api/admin/family/:familyId",async(req,res)=>{
  try{
    const adminKey=process.env.ADMIN_KEY || "Akashkey123";
    if(!adminKey || req.headers["x-admin-key"]!==adminKey) return res.status(401).json({ok:false,error:"Unauthorized"});
    await connectDB();
    const familyId=String(req.params.familyId||"").trim();
    if(!familyId) return res.status(400).json({ok:false,error:"Family ID is required"});
    const result=await Person.deleteMany({familyId});
    res.json({ok:true,deletedCount:result.deletedCount||0});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
});

app.get("/api/admin/families",async(req,res)=>{
  try{
    const adminKey=process.env.ADMIN_KEY || "Akashkey123";
    if(!adminKey || req.headers["x-admin-key"]!==adminKey) return res.status(401).json({ok:false,error:"Unauthorized"});
    await connectDB();
    res.json({ok:true,families:await Person.aggregate([
      {$group:{_id:"$familyId",people:{$sum:1},latest:{$max:"$createdAt"}}},
      {$sort:{latest:-1}}
    ])});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
});



// Admin: update a member name without changing that member's add-link/token.
// Admin: add a child/member directly under an existing member.
app.post("/api/admin/person/:id/add",upload.single("photo"),async(req,res)=>{
  try{
    const adminKey=process.env.ADMIN_KEY || "Akashkey123";
    if(!adminKey || req.headers["x-admin-key"]!==adminKey)
      return res.status(401).json({ok:false,error:"Unauthorized"});
    await connectDB();
    const parent=await Person.findById(req.params.id);
    if(!parent) return res.status(404).json({ok:false,error:"Parent member not found"});
    if(parent.generation>=13) return res.status(400).json({ok:false,error:"This family tree has reached the maximum of 13 generations."});
    const name=(req.body.name||"").trim();
    if(!name) return res.status(400).json({ok:false,error:"Name is required"});
    const child=await Person.create({
      familyId:parent.familyId,
      name,
      parentId:parent._id,
      generation:parent.generation+1,
      photo:photoData(req.file),
      addToken:newToken()
    });
    res.json({ok:true,person:child,addLink:"/add/"+child.addToken});
  }catch(e){
    res.status(400).json({ok:false,error:e.message.includes("File too large")?"Photo is too large. Maximum 50MB allowed.":e.message});
  }
});

app.put("/api/admin/person/:id",async(req,res)=>{
  try{
    const adminKey=process.env.ADMIN_KEY || "Akashkey123";
    if(!adminKey || req.headers["x-admin-key"]!==adminKey) return res.status(401).json({ok:false,error:"Unauthorized"});
    await connectDB();
    const name=(req.body.name||"").trim();
    if(!name) return res.status(400).json({ok:false,error:"Name is required"});
    const p=await Person.findByIdAndUpdate(req.params.id,{name},{new:true}).lean();
    if(!p) return res.status(404).json({ok:false,error:"Member not found"});
    res.json({ok:true,person:p});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
});

// Explicit member-link route so Vercel/Express always serves the add form at /add/<token>.
app.get("/add/:token",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));

app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

module.exports={app,connectDB};
