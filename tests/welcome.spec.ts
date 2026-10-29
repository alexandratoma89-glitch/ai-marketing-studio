import {test,expect} from '@playwright/test';
test('welcome popup closes with Escape, remembers dismissal, and submits an explicit email request',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Oferta de bun venit'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Oferta de bun venit'})).toBeFocused();
 await page.getByRole('button',{name:'Oferta de bun venit'}).click();await dialog.getByLabel('Adresa ta de email').fill('welcome-browser@example.com');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Trimite-mi oferta de 10%'}).click();await expect(dialog.getByRole('status')).toContainText('Emailul a fost simulat');await page.keyboard.press('Escape');await page.reload();await page.waitForTimeout(13000);await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('standalone offer fits mobile and the API rejects cross-origin requests',async({page,request})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/bun-venit');await expect(page.getByLabel('Adresa ta de email')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const denied=await request.post('/api/welcome',{headers:{Origin:'https://unrelated.example'},data:{}});expect(denied.status()).toBe(403);
 await page.screenshot({path:'/tmp/welcome-mobile.png',fullPage:true});
});
