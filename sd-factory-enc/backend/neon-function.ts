// Fetch-compatible API handler source. Requires DATABASE_URL and SDE_API_KEY.
import { Pool } from 'pg';
const pool = process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:5000}) : null;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const validUuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const validKey=(v:unknown):v is string=>typeof v==='string'&&v.length<=512&&/^[A-Za-z0-9][A-Za-z0-9/_\-.]*$/.test(v)&&!v.split('/').some(x=>x==='.'||x==='..');

export default { async fetch(req:Request):Promise<Response> {
  const url=new URL(req.url);
  if(req.method==='GET'&&url.pathname==='/health'){
    if(!pool)return json({service:'S.D Factory Enc API',status:'degraded',database:'not_configured'},503);
    try{await pool.query('SELECT 1');return json({service:'S.D Factory Enc API',status:'ok',database:'ok',protectionEngine:'not-installed'});}
    catch{return json({service:'S.D Factory Enc API',status:'degraded',database:'unavailable'},503);}
  }
  const key=process.env.SDE_API_KEY;
  if(!key||req.headers.get('authorization')!==`Bearer ${key}`)return json({error:'unauthorized'},401);
  if(!pool)return json({error:'service_not_configured'},503);
  try{
    if(req.method==='POST'&&url.pathname==='/v1/jobs'){
      const body=await req.json().catch(()=>null) as any;
      const sha=typeof body?.sha256==='string'?body.sha256.toLowerCase():'';
      if(!body||!validKey(body.originalKey)||!/^[a-f0-9]{64}$/.test(sha))return json({error:'invalid_request',message:'A safe uploaded-object key and SHA-256 are required.'},400);
      const r=await pool.query(`INSERT INTO sde_jobs(status,original_key,original_sha256) VALUES('uploaded',$1,$2) RETURNING id,status,created_at`,[body.originalKey,sha]);
      return json(r.rows[0],201);
    }
    const m=url.pathname.match(/^\/v1\/jobs\/([0-9a-f-]{36})(?:\/(selection|protect))?$/i);
    if(!m||!validUuid(m[1]))return json({error:'not_found'},404);
    const id=m[1];
    if(req.method==='GET'&&!m[2]){
      const r=await pool.query('SELECT id,status,package_name,version_name,min_sdk,target_sdk,activities,selected_activities,protection_state,error_code,error_message,created_at,updated_at FROM sde_jobs WHERE id=$1',[id]);
      return r.rowCount?json(r.rows[0]):json({error:'not_found'},404);
    }
    if(req.method==='POST'&&m[2]==='selection'){
      const body=await req.json().catch(()=>null) as any;
      if(!body||!Array.isArray(body.activities)||body.activities.length>500||body.activities.some((x:unknown)=>typeof x!=='string'||x.length<1||x.length>512)||new Set(body.activities).size!==body.activities.length)return json({error:'invalid_selection'},400);
      const current=await pool.query('SELECT status,activities FROM sde_jobs WHERE id=$1',[id]);
      if(!current.rowCount)return json({error:'not_found'},404);
      if(!['ready','uploaded'].includes(current.rows[0].status))return json({error:'job_not_selectable'},409);
      const eligible=new Set<string>((current.rows[0].activities||[]).filter((a:any)=>a&&a.eligible===true).map((a:any)=>a.name));
      const unknown=body.activities.filter((name:string)=>!eligible.has(name));
      if(unknown.length)return json({error:'unknown_or_ineligible_activities',activities:unknown},400);
      const r=await pool.query("UPDATE sde_jobs SET selected_activities=$2,updated_at=now() WHERE id=$1 AND status IN ('ready','uploaded') RETURNING id,selected_activities",[id,body.activities]);
      return r.rowCount?json(r.rows[0]):json({error:'job_not_selectable'},409);
    }
    if(req.method==='POST'&&m[2]==='protect'){
      const current=await pool.query('SELECT status FROM sde_jobs WHERE id=$1',[id]);
      if(!current.rowCount)return json({error:'not_found'},404);
      if(!['ready','uploaded'].includes(current.rows[0].status))return json({error:'job_not_protectable',status:current.rows[0].status},409);
      await pool.query("UPDATE sde_jobs SET status='failed',protection_state='blocked_engine_missing',error_code='PROTECTION_ENGINE_NOT_DEPLOYED',error_message='Native DEX transformation and runtime loader engine has not passed validation.',updated_at=now() WHERE id=$1",[id]);
      return json({error:'protection_engine_not_deployed',message:'Protection is disabled until the native engine is deployed and device-tested.'},503);
    }
    return json({error:'not_found'},404);
  }catch(error){console.error('S.D Factory Enc API request failed',error);return json({error:'internal_error'},500);}
}};
