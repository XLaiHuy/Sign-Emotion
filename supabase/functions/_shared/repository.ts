import { createClient } from '@supabase/supabase-js';
import { type Repository, sha256 } from './handler.ts';
export function repository(url:string,key:string):Repository {
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return {
    async rateLimit(bucket,action){const {data,error}=await db.rpc('consume_rate_limit',{bucket_key:bucket,action_name:action});if(error)throw error;return Boolean(data);},
    async submit(report,tokenHash){const {data,error}=await db.rpc('submit_pilot_report',{report:report,token_hash:tokenHash,payload_hash:await sha256(JSON.stringify(report))});if(error)throw error;return data;},
    async withdraw(id,tokenHash){const {data,error}=await db.rpc('withdraw_pilot_report',{report_id:id,token_hash:tokenHash});if(error)throw error;return Boolean(data);},
  };
}
