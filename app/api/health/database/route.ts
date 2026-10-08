import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
 const user = await currentUser();
 if (!user || user.role !== 'admin') return NextResponse.json({error:'No autorizado'},{status:401,headers:{'Cache-Control':'no-store'}});
 const started=Date.now();
 try {
  const client=await db().connect();
  try {
   await client.query('BEGIN READ ONLY');
   const result=await client.query("SELECT current_database() AS database_name, current_user AS db_user, to_regclass('public.companies') IS NOT NULL AS has_companies, to_regclass('public.daily_counts') IS NOT NULL AS has_daily_counts");
   await client.query('COMMIT');
   return NextResponse.json({status:'connected',latency_ms:Date.now()-started,schema:{companies:result.rows[0].has_companies,daily_counts:result.rows[0].has_daily_counts}},{headers:{'Cache-Control':'no-store'}});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release()}
 }catch(e){
  const code=(e as {code?:string}).code;
  const category=code==='28P01'?'authentication':code==='3D000'?'database_missing':code==='42501'?'permission':code==='ECONNREFUSED'?'connection_refused':code==='ETIMEDOUT'?'timeout':'connection_error';
  return NextResponse.json({status:'unavailable',category},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
