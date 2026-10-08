const { Client } = require('pg');
(async () => {
 const url=process.env.DATABASE_URL;
 if (!url) { console.log('[DB-CHECK] missing_database_url'); return; }
 const client=new Client({connectionString:url,connectionTimeoutMillis:6000,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:true}:undefined});
 try {
  await client.connect();
  const result=await client.query("SELECT 1 AS ok, to_regclass('public.companies') IS NOT NULL AS companies_table");
  console.log('[DB-CHECK] connected; companies_table='+result.rows[0].companies_table);
 } catch(err) {
  const code=err.code || 'UNKNOWN';
  const known={ECONNREFUSED:'connection_refused',ETIMEDOUT:'timeout',ENOTFOUND:'dns',EHOSTUNREACH:'host_unreachable','28P01':'invalid_credentials','3D000':'database_missing','28000':'authorization_failed'};
  console.log('[DB-CHECK] failed; category='+(known[code]||'other')+'; code='+String(code).replace(/[^a-zA-Z0-9]/g,'').slice(0,12));
 } finally { await client.end().catch(()=>{}); }
})();
