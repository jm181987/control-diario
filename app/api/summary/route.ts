import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { db } from '../../../lib/db';
export const runtime='nodejs';
export async function GET(request:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:'No autorizado'},{status:401});
 const params=new URL(request.url).searchParams;
 const month=params.get('month');
 if(!month||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:'Mes inválido'},{status:400});
 const company=params.get('company');
 if(company && !/^[0-9a-f-]{36}$/i.test(company))return NextResponse.json({error:'Empresa inválida'},{status:400});
 try{
 const r=await db().query(`
 SELECT v.company_id,c.name AS company,v.seller_id,s.name AS seller,t.name AS team,m.name AS management,
 to_char(v.sale_date,'YYYY-MM-DD') AS sale_date,v.consolidated AS sales,v.needs_review
 FROM daily_sales_totals v
 JOIN companies c ON c.id=v.company_id JOIN sellers s ON s.id=v.seller_id
 JOIN teams t ON t.id=s.team_id JOIN managements m ON m.id=t.management_id
 WHERE v.sale_date>=($1||'-01')::date AND v.sale_date<(($1||'-01')::date+interval '1 month')
 AND ($2::uuid IS NULL OR v.company_id=$2::uuid)
 AND ($3='admin' OR EXISTS(SELECT 1 FROM user_scopes sc WHERE sc.user_id=$4::uuid AND sc.company_id=v.company_id
 AND (sc.management_id IS NULL OR sc.management_id=t.management_id)
 AND (sc.team_id IS NULL OR sc.team_id=t.id)))
 AND ($3<>'seller' OR EXISTS(SELECT 1 FROM app_users au WHERE au.id=$4::uuid AND au.seller_id=v.seller_id))
 ORDER BY c.name,t.name,s.name,v.sale_date`,[month,company||null,user.role,user.id]);
 const rows=r.rows.map(x=>({...x,sales:x.sales===null?null:Number(x.sales)}));
 const companies=[...new Map(rows.map(x=>[x.company_id,{company_id:x.company_id,company:x.company}])).values()].map(c=>({...c,sales:rows.filter(x=>x.company_id===c.company_id).reduce((n,x)=>n+(x.sales??0),0),needs_review:rows.filter(x=>x.company_id===c.company_id&&x.needs_review).length}));
 return NextResponse.json({month,companies,days:new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate(),daily:rows});
 }catch(e){console.error('[summary]',e instanceof Error?e.message:'error');return NextResponse.json({error:'No se pudo consultar el resumen'},{status:500})}
}
