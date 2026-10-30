import {test,expect} from '@playwright/test';
const authorization='Basic '+Buffer.from('test-owner:test-only-password-with-at-least-24-characters').toString('base64');
test('invoice endpoints require owner access and same-origin requests; customer tokens are required',async({request})=>{
 expect((await request.get('/api/studio/invoices')).status()).toBe(401);
 expect((await request.post('/api/studio/invoices',{headers:{Authorization:authorization,Origin:'https://wrong.example'},data:{orderId:'invalid'}})).status()).toBe(403);
 expect((await request.post('/api/commerce/manage',{headers:{Origin:'http://localhost:3100'},data:{token:'invalid',action:'view'}})).status()).toBe(401);
 const overview=await request.get('/api/studio/invoices',{headers:{Authorization:authorization}});expect(overview.status()).toBe(200);expect((await overview.json()).invoices).toEqual([]);
});
test('owner invoice view uses existing invoice links and syncs the selected booking without creating a checkout',async({page})=>{
 await page.setExtraHTTPHeaders({Authorization:authorization});const id='11111111-1111-4111-8111-111111111111';let checkoutCalls=0,syncs=0;
 const invoice={id:'in_test',order_id:id,status:'paid',number:'TEST-001',currency:'ron',total:16110,hosted_url:'https://invoice.stripe.com/i/test',pdf_url:'https://pay.stripe.com/invoice/test.pdf'};
 await page.route('**/api/commerce/checkout',route=>{checkoutCalls++;return route.abort();});
 await page.route('**/api/studio/invoices',route=>{if(route.request().method()==='POST'){expect(route.request().postDataJSON()).toEqual({orderId:id});syncs++;return route.fulfill({json:{invoice}});}return route.fulfill({json:{enabled:true,invoices:[invoice]}});});
 await page.setViewportSize({width:390,height:844});await page.goto(`/studio/invoices?order=${id}`);await expect(page.getByText('TEST-001')).toBeVisible();await expect(page.getByRole('textbox')).toHaveValue(id);await expect(page.getByRole('link',{name:'Vezi factura de test în Stripe ↗'})).toHaveAttribute('href',invoice.hosted_url);await page.getByRole('button',{name:'Sincronizează factura existentă'}).click();await expect(page.getByRole('status')).toContainText('sincronizată');expect(syncs).toBe(1);expect(checkoutCalls).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
