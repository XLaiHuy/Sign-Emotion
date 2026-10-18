import { submissionSchema, withdrawalSchema, type PilotReport } from '../../../src/shared/contracts.ts';

export interface Repository {
  rateLimit(key: string, action: string): Promise<boolean>;
  submit(report: PilotReport, tokenHash: string): Promise<'created'|'duplicate'|'conflict'|'withdrawn'>;
  withdraw(id: string, tokenHash: string): Promise<boolean>;
}
export async function sha256(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join(''); }
export function createHandler(action:'submit'|'withdraw', repo:Repository, origins:string[], rateSalt:string) {
  return async(request:Request):Promise<Response>=>{
    const origin=request.headers.get('origin')??'';
    const headers:Record<string,string> = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin' };
    const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
    if(!origin||!origins.includes(origin))return reply(403,{error:'Origin not allowed'});
    headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='content-type, apikey, authorization, x-client-info';headers['Access-Control-Allow-Methods']='POST, OPTIONS';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
    if(!request.headers.get('content-type')?.includes('application/json'))return reply(415,{error:'JSON required'});
    if(!rateSalt)return reply(503,{error:'Server is not configured'});
    try {
      const ip=(request.headers.get('x-forwarded-for')??'unknown').split(',')[0].trim();
      const bucket=await sha256(`${rateSalt}:${new Date().toISOString().slice(0,10)}:${ip}`);
      if(!await repo.rateLimit(bucket,action))return reply(429,{error:'Too many requests'});
      if(Number(request.headers.get('content-length')??0)>16384)return reply(413,{error:'Payload too large'});
      const reader=request.body?.getReader();if(!reader)return reply(400,{error:'Body required'});
      const chunks:Uint8Array[]=[];let length=0;
      while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();return reply(413,{error:'Payload too large'});}chunks.push(value);}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      let input:unknown;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{error:'Invalid JSON'});}
      if(action==='submit'){
        const parsed=submissionSchema.safeParse(input);if(!parsed.success)return reply(400,{error:'Invalid report'});
        const result=await repo.submit(parsed.data.report,await sha256(parsed.data.deletionToken));
        if(result==='conflict'||result==='withdrawn')return reply(409,{error:result});
        return reply(result==='created'?201:200,{id:parsed.data.report.id,status:result});
      }
      const parsed=withdrawalSchema.safeParse(input);if(!parsed.success)return reply(400,{error:'Invalid deletion request'});
      const removed=await repo.withdraw(parsed.data.reportId,await sha256(parsed.data.deletionToken));
      return removed?reply(200,{status:'withdrawn'}):reply(403,{error:'Invalid deletion code'});
    }catch{return reply(503,{error:'Service unavailable; retry later'});}
  };
}
