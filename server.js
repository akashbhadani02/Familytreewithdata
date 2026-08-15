require("dotenv").config();
const {app,connectDB}=require("./app");
const PORT=process.env.PORT||3000;
connectDB().then(()=>app.listen(PORT,()=>console.log("Running http://localhost:"+PORT))).catch(e=>{console.error(e);process.exit(1)});
