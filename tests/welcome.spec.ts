import {test,expect} from '@playwright/test';
test('free-only homepage avoids a purchase offer and still collects requested reading emails',async({page})=>{test.setTimeout(45000);
 let submitted:any;await page.route('**/api/public/reading',route=>{submitted=route.request().postDataJSON();return route.fulfill({status:202,json:{accepted:true}});});await page.goto('/ro');await expect(page.locator('.dw-launch-notice')).toContainText('Achizițiile nu sunt încă disponibile.');await expect(page.getByRole('button',{name:'Oferta de bun venit'})).toHaveCount(0);
 await page.locator('.dw-launch-notice').getByRole('link',{name:'Lectură gratuită și noutăți'}).click();await page.getByLabel('Prenume').fill('Ana');await page.getByRole('textbox',{name:'Email',exact:true}).fill(`free-launch-${Date.now()}@example.com`);await expect(page.getByRole('checkbox')).not.toBeChecked();
 const delivered=page.waitForResponse(response=>response.url().endsWith('/api/public/reading')&&response.request().method()==='POST');await page.getByRole('button',{name:'Trimite-mi lectura prin email'}).click();expect((await delivered).status()).toBe(202);await expect(page.getByRole('status')).toContainText('Solicitarea ta a fost salvată');expect(submitted.marketingConsent).toBe(false);expect(submitted.locale).toBe('ro');
});
test('standalone offer fits mobile and the API rejects cross-origin requests',async({page,request})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/bun-venit');await expect(page.getByLabel('Adresa ta de email')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const denied=await request.post('/api/welcome',{headers:{Origin:'https://unrelated.example'},data:{}});expect(denied.status()).toBe(403);
 await page.screenshot({path:'/tmp/welcome-mobile.png',fullPage:true});
});
