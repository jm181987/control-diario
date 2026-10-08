import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { db } from '../../../lib/db';
export const runtime='nodejs';
export async function GET(){
 const u=await currentUser();if(!u)return NextResponse.json({error:'No autorizado'},{status:401});
 try {
 const admin=u.role==='admin';
 const companies=await db().query('SELECT id,name FROM companies c WHERE $1::boolean OR EXISTS(SELECT 1 FROM user_scopes s WHERE s.company_id=c.id AND s.user_id=$2::uuid) ORDER BY name',[admin,u.id]);
 const sellers=await db().query(`SELECT s.id,s.name,s.company_id,t.name AS team,m.name AS management FROM sellers s JOIN teams t ON t.id=s.team_id JOIN managements m ON m.id=t.management_id WHERE $1::boolean OR EXISTS(SELECT 1 FROM user_scopes sc WHERE sc.company_id=s.company_id AND sc.user_id=$2::uuid AND (sc.management_id IS NULL OR sc.management_id=m.id) AND (sc.team_id IS NULL OR sc.team_id=t.id)) AND ($3<>'seller' OR EXISTS(SELECT 1 FROM app_users au WHERE au.id=$2::uuid AND au.seller_id=s.id)) ORDER BY s.name`,[admin,u.id,u.role]);
 return NextResponse.json({role:u.role,companies:companies.rows,sellers:sellers.rows},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'No se pudo consultar el catálogo'},{status:503})}
}
