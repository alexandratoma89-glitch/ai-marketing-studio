import type {NextConfig} from 'next';
const nextConfig:NextConfig={serverExternalPackages:['@electric-sql/pglite'],async headers(){return ['/api/:path*','/tarot-gratuit/:path*','/cont/:path*','/rezervare/:path*','/studio/:path*'].map(source=>({source,headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]}));}};
export default nextConfig;
