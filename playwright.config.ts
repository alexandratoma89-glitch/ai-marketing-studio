import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({testDir:'./tests',fullyParallel:false,workers:1,reporter:'list',use:{baseURL:'http://localhost:3100',headless:true,launchOptions:{...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']}},webServer:{command:'npm run dev -- --port 3100',url:'http://localhost:3100/tarot-gratuit',reuseExistingServer:false,timeout:120000,env:{TAROT_SITE_URL:'http://localhost:3100'} }});
