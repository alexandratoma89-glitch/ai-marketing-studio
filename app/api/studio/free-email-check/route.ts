import {brevoReadiness} from '@/lib/tarot/brevo-readiness';
import {freeReadingEmailRequirements} from '@/lib/tarot/free-email';
import {noStore} from '@/lib/commerce/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Existing /api/studio middleware requires owner Basic authentication.
export async function GET(){return Response.json({deployment:{commit:process.env.VERCEL_GIT_COMMIT_SHA??null,host:process.env.VERCEL_URL??null},settings:Object.fromEntries(freeReadingEmailRequirements()),provider:await brevoReadiness()},{headers:noStore});}
