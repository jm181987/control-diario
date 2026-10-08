import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { db } from '../../../lib/db';
export const runtime='nodejs';
export async function GET(request:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:'No autorizado'},{status:401});
 const params=new URL(request.url).searchParams;
 const month=params.get('month');
 if(!month||!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:'Mes inválido (AAAA-MM)'},{status:400});
 const company=params.get('company');
 if(company && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(company))return NextResponse.json({error:'Empresa inválida'},{status:400});
 try{
 const result=await db().query(`
 SELECT c.id AS company_id,c.name AS company,COALESCE(SUM(v.consolidated),0)::integer AS sales,
 COUNT(*) FILTER(WHERE v.needs_review)::integer AS needs_review
 FROM daily_sales_totals v JOIN companies c ON c.id=v.company_id
 WHERE v.sale_date >= ($1||'-01')::date AND v.sale_date < (($1||'-01')::date+interval '1 month')
 AND ($2::uuid IS NULL OR c.id=$2::uuid)
 AND ($3='admin' OR EXISTS (
 SELECT 1 FROM user_scopes sc WHERE sc.user_id=$4::uuid AND sc.company_id=v.company_id
 AND (sc.management_id IS NULL OR EXISTS(SELECT 1 FROM teams t WHERE t.id=v.team_id AND t.management_id=sc.management_id))
 AND (sc.team_id IS NULL OR sc.team_id=v.team_id)))
 AND ($3<>'seller' OR EXISTS(SELECT 1 FROM app_users u WHERE u.id=$4::uuid AND u.seller_id=v.seller_id))
 GROUP BY c.id,c.name ORDER BY sales DESC`,[month,company||null,user.role,user.id]);
 return NextResponse.json({month,companies:result.rows});
 }catch{return NextResponse.json({error:'No se pudo consultar el resumen'},{status:500})}
}
