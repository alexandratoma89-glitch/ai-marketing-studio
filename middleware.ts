import {NextRequest,NextResponse} from 'next/server';
import {authorized,credentialsReady} from './lib/studio/auth';
export async function middleware(request:NextRequest){
 const username=process.env.STUDIO_USERNAME,password=process.env.STUDIO_PASSWORD;
 const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Vary':'Authorization'};
 if(!credentialsReady(username,password))return new NextResponse('Studioul privat este blocat până la configurarea accesului de administrator.',{status:503,headers});
 if(!(await authorized(request.headers.get('authorization'),username,password)))return new NextResponse('Autentificare necesară pentru studioul privat.',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="The Divine Work Studio", charset="UTF-8"'}});
 const response=NextResponse.next();for(const [name,value] of Object.entries(headers))response.headers.set(name,value);return response;
}
export const config={matcher:['/studio/:path*','/api/studio/:path*']};
