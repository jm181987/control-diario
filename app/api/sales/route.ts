import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '../../../lib/auth';
import { db } from '../../../lib/db';
export const runtime='nodejs';
const payload=z.object({seller_id:z.string().uuid(),sale_date:z.iso.date(),mode:z.enum(['daily','individual']),quantity:z.number().int().min(0).max(100000).optional(),included_in_daily_count:z.boolean().optional()});
export async function POST(request:Request){
 const u=await currentUser();if(!u||u.role==='analyst')return NextResponse.json({error:'No autorizado'},{status:403});
 const origin=request.headers.get('origin');const host=request.headers.get('host');
 if(!origin||!host||new URL(origin).host!==host)return NextResponse.json({error:'Origen no autorizado'},{status:403});
 const parsed=payload.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Datos inválidos'},{status:400});
 const p=parsed.data;if(p.mode==='daily'&&p.quantity===undefined)return NextResponse.json({error:'Cantidad obligatoria'},{status:400});
 const client=await db().connect().catch(()=>null);if(!client)return NextResponse.json({error:'Sin conexión a la base de datos'},{status:503});
 try{
 await client.query('BEGIN');
 const scope=await client.query(`SELECT s.company_id FROM sellers s JOIN teams t ON t.id=s.team_id WHERE s.id=$1 AND ($2='admin' OR EXISTS(SELECT 1 FROM user_scopes sc WHERE sc.user_id=$3::uuid AND sc.company_id=s.company_id AND (sc.management_id IS NULL OR sc.management_id=t.management_id) AND (sc.team_id IS NULL OR sc.team_id=t.id))) AND ($2<>'seller' OR EXISTS(SELECT 1 FROM app_users au WHERE au.id=$3::uuid AND au.seller_id=s.id))`,[p.seller_id,u.role,u.id]);
 if(!scope.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'Vendedor fuera de tu alcance'},{status:403})}
 const company=scope.rows[0].company_id;
 let id:string;
 if(p.mode==='daily'){
 const r=await client.query(`INSERT INTO daily_counts(company_id,seller_id,sale_date,quantity,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(seller_id,sale_date) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now() RETURNING id`,[company,p.seller_id,p.sale_date,p.quantity,u.id]);id=r.rows[0].id;
 }else{
 const r=await client.query(`INSERT INTO individual_sales(company_id,seller_id,sale_date,included_in_daily_count,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id`,[company,p.seller_id,p.sale_date,p.included_in_daily_count??false,u.id]);id=r.rows[0].id;
 }
 await client.query('INSERT INTO audit_log(actor_id,action,entity_type,entity_id,new_data) VALUES($1,$2,$3,$4,$5::jsonb)',[u.id,'create_or_update',p.mode,id,JSON.stringify(p)]);
 await client.query('COMMIT');return NextResponse.json({ok:true,id});
 }catch{await client.query('ROLLBACK').catch(()=>{});return NextResponse.json({error:'No se pudo guardar'},{status:500})}finally{client.release()}
}
