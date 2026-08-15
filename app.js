require("dotenv").config();
const express=require("express");
const mongoose=require("mongoose");
const path=require("path");
const multer=require("multer");
const crypto=require("crypto");

const app=express();
const MONGO_URI=process.env.MONGO_URI;
if(!MONGO_URI) console.warn("MONGO_URI is not set.");

app.use(express.json({limit:"5mb"}));
app.use(express.urlencoded({extended:true,limit:"5mb"}));
app.use(express.static(path.join(__dirname,"public")));

const storage=multer.memoryStorage();
const upload=multer({
  storage,
  limits:{fileSize:2*1024*1024},
  fileFilter:(req,file,cb)=>cb(null,/^image\/(jpeg|png|webp)$/.test(file.mimetype))
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
  }catch(e){res.status(400).json({ok:false,error:e.message})}
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
    res.json({ok:true,person:p,addLink:"/add/"+p.addToken});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
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

app.delete("/api/person/:id",async(req,res)=>{
  try{
    await connectDB();
    const p=await Person.findById(req.params.id);
    if(!p)return res.status(404).json({ok:false,error:"Not found"});
    await Person.deleteMany({familyId:p.familyId,parentId:p._id});
    await p.deleteOne();
    res.json({ok:true});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
});

app.get("/api/admin/families",async(req,res)=>{
  try{
    await connectDB();
    res.json({ok:true,families:await Person.aggregate([
      {$group:{_id:"$familyId",people:{$sum:1},latest:{$max:"$createdAt"}}},
      {$sort:{latest:-1}}
    ])});
  }catch(e){res.status(400).json({ok:false,error:e.message})}
});

app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

module.exports={app,connectDB};
