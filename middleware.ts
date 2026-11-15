import {NextRequest,NextResponse} from 'next/server';
import {preferredLocale,isLocale,legacyRoutes} from './lib/public/i18n';
import {authorized,credentialsReady} from './lib/studio/auth';
export async function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(!path.startsWith('/studio')&&!path.startsWith('/api/studio')){const locale=path.split('/')[1];if(isLocale(locale)){const requestHeaders=new Headers(request.headers);requestHeaders.set('x-divine-locale',locale);const response=NextResponse.next({request:{headers:requestHeaders}});response.cookies.set('divine_locale',locale,{path:'/',maxAge:31536000,sameSite:'lax',secure:process.env.NODE_ENV==='production'});return response;}const target=legacyRoutes[path];if(target!==undefined){const selected=path==='/'?preferredLocale(request.cookies.get('divine_locale')?.value,request.headers.get('accept-language')??''):'ro';const url=request.nextUrl.clone();url.pathname=`/${selected}${target?'/'+target:''}`;const redirect=NextResponse.redirect(url,307);redirect.headers.set('Cache-Control','private, no-store');redirect.headers.set('Vary','Cookie, Accept-Language');return redirect;}return NextResponse.next();}
 const username=process.env.STUDIO_USERNAME,password=process.env.STUDIO_PASSWORD;
 const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Vary':'Authorization'};
 if(!credentialsReady(username,password))return new NextResponse('Studioul privat este blocat până la configurarea accesului de administrator.',{status:503,headers});
 if(!(await authorized(request.headers.get('authorization'),username,password)))return new NextResponse('Autentificare necesară pentru studioul privat.',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="The Divine Work Studio", charset="UTF-8"'}});
 const response=NextResponse.next();for(const [name,value] of Object.entries(headers))response.headers.set(name,value);return response;
}
export const config={matcher:['/studio/:path*','/api/studio/:path*','/','/en/:path*','/ro/:path*','/tarot-gratuit/:path*','/termeni','/cont','/rezervare/status','/bun-venit','/social-data-privacy','/instagram-data-deletion']};
