import type {NextConfig} from 'next';
const nextConfig:NextConfig={async headers(){return ['/api/tarot/:path*','/tarot-gratuit/:path*'].map(source=>({source,headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]}));}};
export default nextConfig;
