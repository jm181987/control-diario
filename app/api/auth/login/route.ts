import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { makeToken, passwordMatches } from '../../../../lib/auth';
export const runtime = 'nodejs';
const schema = z.object({email:z.email(),password:z.string().min(1).max(256)});
export async function POST(request:Request) {
 try {
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:'Datos inválidos'},{status:400});
  const {email,password}=parsed.data;
  const result=await db().query('SELECT id,role,password_hash,disabled FROM app_users WHERE lower(email)=lower($1)',[email]);
  const user=result.rows[0];
  if(!user||user.disabled)return NextResponse.json({error:'Credenciales incorrectas'},{status:401});
  const hash:string=user.password_hash;
  let valid=false;
  if(hash.startsWith('$2a$')||hash.startsWith('$2b$')||hash.startsWith('$2y$')){
   const check=await db().query('SELECT crypt($1,$2) = $2 AS valid',[password,hash]);
   valid=check.rows[0]?.valid===true;
  }else{
   valid=passwordMatches(password,hash);
  }
  if(!valid)return NextResponse.json({error:'Credenciales incorrectas'},{status:401});
  const token=makeToken({id:user.id,role:user.role,exp:Date.now()+8*60*60*1000});
  const res=NextResponse.json({ok:true,role:user.role});
  res.cookies.set('cd_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*60*60});
  return res;
 }catch(error){
  console.error('[auth/login]',error instanceof Error?error.message:'Unknown login error');
  const configError=error instanceof Error && error.message.includes('SESSION_SECRET');
  return NextResponse.json({error:configError?'Configuración de sesión inválida: SESSION_SECRET debe tener al menos 32 caracteres':'Error interno al iniciar sesión. Revisá los logs de la función /api/auth/login en Vercel.'},{status:500});
 }
}
