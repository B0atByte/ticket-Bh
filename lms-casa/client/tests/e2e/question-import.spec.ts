/**
 * E2E — Question bulk import dialog
 * Tests: CSV upload → preview → save, and AI draft tab (local fallback)
 * Uses admin credentials. Creates and cleans up a temp question bank.
 */
import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@lmscasa.local';
const ADMIN_PASSWORD = 'Admin@12345';
const API = 'http://localhost:4000/api/v1';

// Minimal CSV for import
const CSV_CONTENT = [
  'type,difficulty,points,question_text,explanation,option_1,option_2,option_3,option_4,correct_answer',
  'SINGLE_CHOICE,EASY,1,"ข้อใดคือสีของท้องฟ้า","ท้องฟ้าเป็นสีฟ้า",แดง,เขียว,ฟ้า,ส้ม,C',
  'MULTIPLE_CHOICE,MEDIUM,2,"เลือกคำตอบที่ถูก",,ตัวเลือก A,ตัวเลือก B,ตัวเลือก C,ตัวเลือก D,"A,C"',
  'TRUE_FALSE,EASY,1,"ดวงอาทิตย์ขึ้นทิศตะวันออก",,ถูก,ผิด,,,TRUE',
].join('\n');

const AI_SOURCE = 'พนักงานร้านกาแฟ';

let adminToken = '';
let testBankId = '';

test.beforeAll(async ({ request }) => {
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const loginData = await loginRes.json() as { tokens: { accessToken: string } };
  adminToken = loginData.tokens.accessToken;

  const bankRes = await request.post(`${API}/question-banks`, {
    data: { name: '[E2E IMPORT TEST]', description: 'temp' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const bankData = await bankRes.json() as { bank: { id: string } };
  testBankId = bankData.bank.id;
});

test.afterAll(async ({ request }) => {
  if (!testBankId || !adminToken) return;

  // Delete all questions in bank before deleting bank
  const qRes = await request.get(`${API}/questions?bankId=${testBankId}&limit=50`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const qData = await qRes.json() as { items?: Array<{ id: string }> };
  for (const q of qData.items ?? []) {
    await request.delete(`${API}/questions/${q.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  await request.delete(`${API}/question-banks/${testBankId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
});

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.locator('#identifier').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('CSV import: upload → preview 3 valid rows → save → questions appear', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/admin/questions');
  await page.waitForSelector('text=ชุดคำถาม', { timeout: 10_000 });

  // Select the test bank from the sidebar
  await page.locator(`text=[E2E IMPORT TEST]`).click();
  await expect(page.locator('text=นำเข้า / AI')).toBeVisible({ timeout: 8_000 });

  // Open the import dialog
  await page.locator('text=นำเข้า / AI').click();
  await expect(page.locator('text=นำเข้าข้อสอบหลายข้อ')).toBeVisible({ timeout: 5_000 });

  // Upload CSV file via input
  const fileInput = page.locator('input[type="file"][accept=".xlsx,.csv"]');
  await fileInput.setInputFiles({
    name: 'import-test.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV_CONTENT, 'utf-8'),
  });

  // Wait for preview to appear with 3 valid
  await expect(page.locator('text=3 ใช้ได้')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('text=0 ต้องแก้')).toBeVisible();

  // Preview table should show question rows
  await expect(page.locator('text=SINGLE_CHOICE')).toBeVisible();
  await expect(page.locator('text=MULTIPLE_CHOICE')).toBeVisible();
  await expect(page.locator('text=TRUE_FALSE')).toBeVisible();

  // Save button should say "บันทึก 3 ข้อ"
  const saveBtn = page.locator('button', { hasText: 'บันทึก 3 ข้อ' });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();

  // Dialog should close after save
  await expect(page.locator('text=นำเข้าข้อสอบหลายข้อ')).not.toBeVisible({ timeout: 8_000 });

  // Questions should now appear in the list
  await expect(page.locator('text=ข้อใดคือสีของท้องฟ้า')).toBeVisible({ timeout: 8_000 });
});

test('AI draft: enter source → generate → local fallback shows → save', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/admin/questions');
  await page.waitForSelector('text=ชุดคำถาม', { timeout: 10_000 });

  // Select the test bank
  await page.locator('text=[E2E IMPORT TEST]').click();
  await expect(page.locator('text=นำเข้า / AI')).toBeVisible({ timeout: 8_000 });

  // Open import dialog
  await page.locator('text=นำเข้า / AI').click();
  await expect(page.locator('text=นำเข้าข้อสอบหลายข้อ')).toBeVisible({ timeout: 5_000 });

  // Switch to AI tab
  await page.locator('button', { hasText: 'AI ช่วยร่าง' }).click();

  // Fill source text (must be at least 100 chars)
  await page.locator('#ai-source').fill(AI_SOURCE);

  // Set count to 3
  await page.locator('#ai-count').fill('3');

  // Generate drafts
  const generateBtn = page.locator('button', { hasText: 'สร้างฉบับร่าง' });
  await expect(generateBtn).toBeEnabled();
  await generateBtn.click();

  // Should show provider label (DeepSeek / OpenAI / Local draft fallback)
  await expect(page.locator('text=Provider:')).toBeVisible({ timeout: 20_000 });

  // Preview table should show 3 draft questions
  await expect(page.locator('text=3 ข้อพร้อมบันทึก')).toBeVisible({ timeout: 5_000 });

  // Save
  const saveBtn = page.locator('button', { hasText: 'บันทึก 3 ข้อ' });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();

  // Dialog closes
  await expect(page.locator('text=นำเข้าข้อสอบหลายข้อ')).not.toBeVisible({ timeout: 8_000 });
});
