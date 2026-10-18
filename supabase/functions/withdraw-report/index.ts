import { createHandler } from '../_shared/handler.ts';
import { repository } from '../_shared/repository.ts';
const origins=(Deno.env.get('ALLOWED_ORIGINS')??'').split(',').map(v=>v.trim()).filter(Boolean);
Deno.serve(createHandler('withdraw',repository(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),origins,Deno.env.get('RATE_LIMIT_SALT')??''));
