import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { writeSuperAdminAudit } from "../lib/adminAuditLog.js";

const router = Router();
const COOKIE_NAME = "cb_admin_token";
const loginLimiter = createRateLimiter({ windowMs: 15*60*1000, max: 10, keyPrefix: "admin-login", message: "Too many sign-in attempts. Please try again later." });
const passwordLimiter = createRateLimiter({ windowMs: 15*60*1000, max: 8, keyPrefix: "admin-password", message: "Too many password attempts. Please try again later." });

function getJwtSecret(){ const secret=process.env.JWT_SECRET; if(!secret) throw new Error("JWT_SECRET is not configured"); return secret; }
function cookieOptions(){ const production=process.env.NODE_ENV === "production"; return { httpOnly:true, secure:production, sameSite:production?"none":"lax", maxAge:8*60*60*1000, path:"/" }; }
function clearCookieOptions(){ const {maxAge,...rest}=cookieOptions(); return rest; }
function adminResponse(user){ return { id:user.id, name:user.name, email:user.email, role:user.role, phone:user.phone||"", jobTitle:user.jobTitle||"" }; }
async function getAdmin(id){ return prisma.user.findUnique({where:{id}}); }

router.post("/login", loginLimiter, async (req,res)=>{
  try{
    const email=String(req.body?.email||"").trim().toLowerCase(); const password=String(req.body?.password||"");
    if(!email||!password) return res.status(400).json({success:false,message:"Email and password are required"});
    const user=await prisma.user.findUnique({where:{email}});
    if(!user||!user.active||user.role!=="SUPER_ADMIN") return res.status(401).json({success:false,message:"Invalid email or password"});
    if(!(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({success:false,message:"Invalid email or password"});
    const token=jwt.sign({sub:user.id,role:user.role},getJwtSecret(),{expiresIn:"8h",algorithm:"HS256"});
    res.cookie(COOKIE_NAME,token,cookieOptions()); return res.json({success:true,token,user:adminResponse(user)});
  }catch(error){console.error("Admin login failed:",error);return res.status(500).json({success:false,message:"Unable to sign in"});}
});

router.get("/me",requireSuperAdmin,async(req,res)=>{
  try{ const user=await getAdmin(req.admin.userId); if(!user||!user.active||user.role!=="SUPER_ADMIN") return res.status(401).json({success:false,message:"Unauthorized"}); return res.json({success:true,user:adminResponse(user)}); }
  catch(error){console.error("Admin session check failed:",error);return res.status(500).json({success:false,message:"Unable to verify session"});}
});

router.patch("/profile",requireSuperAdmin,async(req,res)=>{
  try{
    const actor=await getAdmin(req.admin.userId); if(!actor||!actor.active||actor.role!=="SUPER_ADMIN") return res.status(401).json({success:false,message:"Unauthorized"});
    const name=String(req.body?.name||"").trim(); const email=String(req.body?.email||"").trim().toLowerCase(); const phone=String(req.body?.phone||"").trim(); const jobTitle=String(req.body?.jobTitle||"").trim();
    if(!name) return res.status(400).json({success:false,message:"Name is required"}); if(!email) return res.status(400).json({success:false,message:"Email is required"});
    const duplicate=await prisma.user.findFirst({where:{email,id:{not:actor.id}},select:{id:true}}); if(duplicate) return res.status(409).json({success:false,message:"This email is already in use"});
    const before={name:actor.name,email:actor.email,phone:actor.phone||"",jobTitle:actor.jobTitle||""};
    const updated=await prisma.user.update({where:{id:actor.id},data:{name,email,phone:phone||null,jobTitle:jobTitle||null}});
    const changedFields=Object.keys(before).filter(k=>String(before[k]||"")!==String(updated[k]||""));
    if(changedFields.length) await writeSuperAdminAudit({req,actor:updated,action:"ADMIN_PROFILE_UPDATED",entityType:"SUPER_ADMIN",entityId:updated.id,summary:`${updated.name} updated the Super Admin profile.`,metadata:{changedFields}});
    return res.json({success:true,message:"Profile updated successfully",user:adminResponse(updated)});
  }catch(error){console.error("Admin profile update failed:",error);return res.status(500).json({success:false,message:"Unable to update profile"});}
});

router.patch("/change-password",requireSuperAdmin,passwordLimiter,async(req,res)=>{
  try{
    const currentPassword=String(req.body?.currentPassword||""); const newPassword=String(req.body?.newPassword||""); const confirmPassword=String(req.body?.confirmPassword||"");
    if(!currentPassword||!newPassword||!confirmPassword) return res.status(400).json({success:false,message:"Current password, new password and confirmation are required"});
    if(newPassword.length<8||!/[A-Z]/.test(newPassword)||!/[a-z]/.test(newPassword)||!/[0-9]/.test(newPassword)) return res.status(400).json({success:false,message:"New password must be at least 8 characters and include uppercase, lowercase and a number"});
    if(newPassword!==confirmPassword) return res.status(400).json({success:false,message:"New password and confirmation do not match"});
    const actor=await getAdmin(req.admin.userId); if(!actor||!actor.active||actor.role!=="SUPER_ADMIN") return res.status(401).json({success:false,message:"Unauthorized"});
    if(!(await bcrypt.compare(currentPassword,actor.passwordHash))) return res.status(400).json({success:false,message:"Current password is incorrect"});
    if(await bcrypt.compare(newPassword,actor.passwordHash)) return res.status(400).json({success:false,message:"New password must be different from the current password"});
    const passwordHash=await bcrypt.hash(newPassword,12); await prisma.user.update({where:{id:actor.id},data:{passwordHash}});
    await writeSuperAdminAudit({req,actor,action:"ADMIN_PASSWORD_CHANGED",entityType:"SUPER_ADMIN",entityId:actor.id,summary:`${actor.name} changed the Super Admin password.`});
    res.clearCookie(COOKIE_NAME,clearCookieOptions()); return res.json({success:true,message:"Password changed successfully. Please sign in again.",signedOut:true});
  }catch(error){console.error("Admin password change failed:",error);return res.status(500).json({success:false,message:"Unable to change password"});}
});

router.post("/logout",(req,res)=>{res.clearCookie(COOKIE_NAME,clearCookieOptions());return res.json({success:true,message:"Signed out"});});
export default router;