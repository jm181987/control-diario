import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
export type Session = {id:string; role:'admin'|'manager'|'supervisor'|'seller'|'analyst';exp:number};
function key(){const k=process.env.SESSION_SECRET;if(!k || k.length<32)throw new Error('SESSION_SECRET must contain at least 32 characters');return k}
function signature(v:string){return createHmac('sha256',key()).update(v).digest('hex')}
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')}
export function passwordMatches(password:string,stored:string){const [salt,hex]=stored.split(':');if(!salt||!hex||hex.length!==128)return false;const a=scryptSync(password,salt,64),b=Buffer.from(hex,'hex');return timingSafeEqual(a,b)}
export function makeToken(s:Session){const body=Buffer.from(JSON.stringify(s)).toString('base64url');return body+'.'+signature(body)}
export async function currentUser():Promise<Session|null>{
 const token=(await cookies()).get('cd_session')?.value;
 if(!token)return null;
 const [body,sig]=token.split('.');if(!body||!sig||sig.length!==64)return null;
 if(!timingSafeEqual(Buffer.from(signature(body)),Buffer.from(sig)))return null;
 try{const s=JSON.parse(Buffer.from(body,'base64url').toString()) as Session;
 if(!s.id||!s.exp||s.exp<Date.now()||!['admin','manager','supervisor','seller','analyst'].includes(s.role))return null;
 const r=await db().query('SELECT role,disabled FROM app_users WHERE id=$1',[s.id]);
 if(r.rowCount!==1||r.rows[0].disabled||r.rows[0].role!==s.role)return null;return s;
 }catch{return null}
}
