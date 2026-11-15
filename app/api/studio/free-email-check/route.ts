import {brevoReadiness} from '@/lib/tarot/brevo-readiness';
import {freeReadingEmailRequirements} from '@/lib/tarot/free-email';
import {noStore} from '@/lib/commerce/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Existing /api/studio middleware requires owner Basic authentication.
export async function GET(){return Response.json({settings:Object.fromEntries(freeReadingEmailRequirements()),provider:await brevoReadiness()},{headers:noStore});}
