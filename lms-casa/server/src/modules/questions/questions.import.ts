import ExcelJS from 'exceljs';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';
import { matchesSignature } from '../../utils/fileSignature.js';
import { CreateQuestionSchema, type CreateQuestionInput } from './questions.schema.js';

/** Strip HTML tags/entities down to readable plain text. */
function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gather all readable text of a course (title, summary, description, module/lesson
 * titles, and TEXT/HTML content bodies) into one source string for AI generation.
 * Video-only lessons contribute their titles/summaries since there is no body text.
 */
export async function buildCourseSourceText(courseId: bigint): Promise<string> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: {
      title: true,
      summary: true,
      description: true,
      modules: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
        select: {
          title: true,
          lessons: {
            where: { deletedAt: null },
            orderBy: { orderIndex: 'asc' },
            select: {
              title: true,
              summary: true,
              contents: {
                where: { deletedAt: null },
                orderBy: { orderIndex: 'asc' },
                select: { type: true, title: true, body: true },
              },
            },
          },
        },
      },
    },
  });
  if (!course) throw HttpError.notFound('ไม่พบหลักสูตร');

  const parts: string[] = [`หลักสูตร: ${course.title}`];
  if (course.summary) parts.push(course.summary);
  if (course.description) parts.push(toPlainText(course.description));

  for (const m of course.modules) {
    parts.push(`บท: ${m.title}`);
    for (const l of m.lessons) {
      parts.push(`บทเรียน: ${l.title}`);
      if (l.summary) parts.push(l.summary);
      for (const c of l.contents) {
        if (c.title) parts.push(c.title);
        if (c.body && (c.type === 'TEXT' || c.type === 'HTML')) parts.push(toPlainText(c.body));
      }
    }
  }

  // Cap to the generate schema's max input length.
  return parts.filter(Boolean).join('\n').slice(0, 30_000);
}

type ImportType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface ImportPreviewRow {
  rowNumber: number;
  question?: CreateQuestionInput;
  errors: string[];
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
}

const TEMPLATE_HEADERS = [
  'type',
  'difficulty',
  'points',
  'question_text',
  'explanation',
  'option_1',
  'option_2',
  'option_3',
  'option_4',
  'option_5',
  'option_6',
  'correct_answer',
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function csvTemplate(): string {
  return [
    TEMPLATE_HEADERS.join(','),
    [
      'SINGLE_CHOICE',
      'MEDIUM',
      '1',
      csvCell('ข้อใดคือแนวทางที่ถูกต้อง'),
      csvCell('คำอธิบายหลังทำข้อสอบ'),
      csvCell('ตัวเลือก A'),
      csvCell('ตัวเลือก B'),
      csvCell('ตัวเลือก C'),
      '',
      '',
      '',
      'A',
    ].join(','),
    [
      'MULTIPLE_CHOICE',
      'MEDIUM',
      '1',
      csvCell('เลือกคำตอบที่ถูกต้องทั้งหมด'),
      '',
      csvCell('ตัวเลือก A'),
      csvCell('ตัวเลือก B'),
      csvCell('ตัวเลือก C'),
      csvCell('ตัวเลือก D'),
      '',
      '',
      'A,C',
    ].join(','),
    [
      'TRUE_FALSE',
      'EASY',
      '1',
      csvCell('ข้อความนี้ถูกต้องหรือไม่'),
      '',
      'ถูก',
      'ผิด',
      '',
      '',
      '',
      '',
      'TRUE',
    ].join(','),
  ].join('\n');
}

export async function parseQuestionFile(file: Express.Multer.File): Promise<ImportPreviewResult> {
  const lowerName = file.originalname.toLowerCase();
  const buffer = file.buffer as unknown as Buffer;
  if (lowerName.endsWith('.xlsx')) {
    if (!matchesSignature(buffer, ['zip'])) {
      throw HttpError.badRequest('ไฟล์ไม่ใช่ XLSX ที่ถูกต้อง');
    }
    return previewRows(await parseXlsx(buffer));
  }
  // CSV is plain text — reject files disguised with a binary extension mismatch.
  if (matchesSignature(buffer, ['zip', 'pdf', 'png', 'jpeg', 'webp'])) {
    throw HttpError.badRequest('ไฟล์ไม่ใช่ CSV ที่ถูกต้อง');
  }
  return previewRows(parseCsv(buffer.toString('utf8')));
}

async function parseXlsx(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw HttpError.badRequest('Workbook has no worksheet');

  const headers = readExcelRow(sheet.getRow(1)).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = readExcelRow(sheet.getRow(rowNumber));
    if (values.every((v) => v.trim() === '')) continue;
    rows.push(toRecord(headers, values, rowNumber));
  }
  return rows;
}

function parseCsv(input: string): Record<string, string>[] {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      table.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  row.push(cell);
  table.push(row);

  const [headersRaw, ...dataRows] = table;
  const headers = (headersRaw ?? []).map((h) => h.replace(/^\uFEFF/, '').trim());
  return dataRows
    .map((values, idx) => toRecord(headers, values, idx + 2))
    .filter((record) =>
      Object.entries(record).some(([key, value]) => key !== '__rowNumber' && value.trim() !== ''),
    );
}

function previewRows(rows: Record<string, string>[]): ImportPreviewResult {
  const preview = rows.map(parseDraftRecord);
  return {
    rows: preview,
    validCount: preview.filter((r) => r.errors.length === 0).length,
    errorCount: preview.filter((r) => r.errors.length > 0).length,
  };
}

function parseDraftRecord(record: Record<string, string>): ImportPreviewRow {
  const rowNumber = Number(record.__rowNumber ?? 0);
  const errors: string[] = [];
  const type = normalizeType(record.type);
  const difficulty = normalizeDifficulty(record.difficulty);
  const points = Number(record.points || 1);
  const text = (record.question_text ?? '').trim();
  const explanation = (record.explanation ?? '').trim();

  if (!type) errors.push('type ต้องเป็น SINGLE_CHOICE, MULTIPLE_CHOICE หรือ TRUE_FALSE');
  if (!difficulty) errors.push('difficulty ต้องเป็น EASY, MEDIUM หรือ HARD');
  if (!Number.isInteger(points) || points < 1 || points > 1000) errors.push('points ต้องเป็นเลข 1-1000');
  if (!text) errors.push('question_text ห้ามว่าง');

  const optionTexts = collectOptions(record, type);
  const correctIndexes = parseCorrectIndexes(record.correct_answer, optionTexts, type);
  if (optionTexts.length < 2) errors.push('ต้องมีตัวเลือกอย่างน้อย 2 ตัว');
  if (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') {
    if (correctIndexes.length !== 1) errors.push('คำถามแบบนี้ต้องมีคำตอบถูก 1 ข้อ');
  }
  if (type === 'MULTIPLE_CHOICE' && correctIndexes.length < 1) {
    errors.push('MULTIPLE_CHOICE ต้องมีคำตอบถูกอย่างน้อย 1 ข้อ');
  }

  if (!type || !difficulty || errors.length > 0) return { rowNumber, errors };

  const question = {
    type,
    difficulty,
    text,
    explanation: explanation || undefined,
    defaultPoints: points,
    options: optionTexts.map((option, index) => ({
      text: option,
      isCorrect: correctIndexes.includes(index),
      orderIndex: index,
    })),
  } satisfies CreateQuestionInput;
  const parsed = CreateQuestionSchema.safeParse(question);
  if (!parsed.success) {
    errors.push('ข้อมูลไม่ตรง schema ของระบบ');
    return { rowNumber, errors };
  }
  return { rowNumber, question: parsed.data, errors };
}

/**
 * Validate that a question's answer key is internally consistent, so AI mistakes
 * (no correct option, or every option marked correct) never reach the question bank.
 *  - SINGLE_CHOICE / TRUE_FALSE: exactly one correct option
 *  - MULTIPLE_CHOICE: at least one correct, but not all of them
 */
export function answerKeyValid(q: CreateQuestionInput): boolean {
  const options = q.options ?? [];
  const total = options.length;
  const correct = options.filter((o) => o.isCorrect).length;
  if (total < 2) return false;
  if (q.type === 'MULTIPLE_CHOICE') return correct >= 1 && correct < total;
  return correct === 1; // SINGLE_CHOICE, TRUE_FALSE
}

/** Drop questions whose answer key is invalid; report how many were dropped. */
function keepValid(questions: CreateQuestionInput[]): { questions: CreateQuestionInput[]; skipped: number } {
  const valid = questions.filter(answerKeyValid);
  return { questions: valid, skipped: questions.length - valid.length };
}

export async function generateQuestionDrafts(input: {
  sourceText: string;
  count: number;
  difficulty: Difficulty;
}): Promise<{ questions: CreateQuestionInput[]; provider: 'deepseek' | 'openai' | 'local'; skipped: number }> {
  if (env.DEEPSEEK_API_KEY) {
    const raw = await generateWithChatCompletions(input, {
      baseUrl: 'https://api.deepseek.com',
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    });
    return { ...keepValid(raw), provider: 'deepseek' };
  }
  if (env.OPENAI_API_KEY) {
    const raw = await generateWithChatCompletions(input, {
      baseUrl: 'https://api.openai.com',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL ?? 'gpt-4o-mini',
    });
    return { ...keepValid(raw), provider: 'openai' };
  }
  return { ...keepValid(generateLocalDrafts(input)), provider: 'local' };
}

async function generateWithChatCompletions(
  input: { sourceText: string; count: number; difficulty: Difficulty },
  config: { baseUrl: string; apiKey: string; model: string },
): Promise<CreateQuestionInput[]> {
  const systemPrompt =
    'คุณเป็นผู้เชี่ยวชาญด้านการออกข้อสอบสำหรับองค์กร ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON';

  const userPrompt =
    `สร้างข้อสอบจากเนื้อหานี้ จำนวน ${input.count} ข้อ ระดับความยาก: ${input.difficulty}\n` +
    `ให้ผสมประเภทคำถาม: SINGLE_CHOICE (ปรนัยเดี่ยว), MULTIPLE_CHOICE (เลือกได้หลายข้อ), TRUE_FALSE (ถูก/ผิด)\n` +
    `- SINGLE_CHOICE: มี 4 ตัวเลือก คำตอบถูก 1 ข้อ\n` +
    `- MULTIPLE_CHOICE: มี 4 ตัวเลือก คำตอบถูก 2-3 ข้อ\n` +
    `- TRUE_FALSE: มีแค่ 2 ตัวเลือก "ถูก" (isCorrect:true) และ "ผิด" (isCorrect:false)\n` +
    `ทุกข้อต้องมีคำอธิบายเฉลย\n\n` +
    `เนื้อหา:\n${input.sourceText}\n\n` +
    `ตอบในรูปแบบ JSON เท่านั้น:\n` +
    `{"questions":[{"type":"SINGLE_CHOICE","text":"คำถาม","explanation":"คำอธิบาย","options":[{"text":"ตัวเลือก","isCorrect":true},...]},...]}`;

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(80_000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw HttpError.badRequest(`AI question generation failed: ${response.status} ${errText.slice(0, 120)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(content) as { questions?: unknown[] };
  const rawQuestions = parsed.questions ?? [];

  const ALLOWED_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']);

  return rawQuestions
    .slice(0, input.count)
    .map((raw) => {
      const item = raw as {
        type?: string;
        text?: string;
        explanation?: string;
        options?: Array<{ text?: string; isCorrect?: boolean }>;
      };
      const type = ALLOWED_TYPES.has(item.type ?? '') ? (item.type as ImportType) : 'SINGLE_CHOICE';
      return CreateQuestionSchema.parse({
        type,
        difficulty: input.difficulty,
        defaultPoints: 1,
        text: item.text ?? '',
        explanation: item.explanation || undefined,
        options: (item.options ?? []).slice(0, 6).map((opt, index) => ({
          text: opt.text ?? '',
          isCorrect: Boolean(opt.isCorrect),
          orderIndex: index,
        })),
      });
    });
}

export async function parseQuestionText(rawText: string): Promise<{
  questions: CreateQuestionInput[];
  provider: 'deepseek' | 'openai' | 'local';
  skipped: number;
}> {
  const config = env.DEEPSEEK_API_KEY
    ? { baseUrl: 'https://api.deepseek.com', apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL ?? 'deepseek-chat', provider: 'deepseek' as const }
    : env.OPENAI_API_KEY
      ? { baseUrl: 'https://api.openai.com', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini', provider: 'openai' as const }
      : null;

  if (!config) {
    throw HttpError.badRequest('ไม่มี AI provider — กรุณาตั้งค่า DEEPSEEK_API_KEY หรือ OPENAI_API_KEY');
  }

  const systemPrompt =
    'คุณเป็นผู้เชี่ยวชาญด้านการแปลงข้อความเป็นข้อสอบ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON';
  const userPrompt =
    `แปลงข้อความข้อสอบด้านล่างให้เป็น JSON ที่มีโครงสร้างถูกต้อง\n` +
    `รองรับประเภท: SINGLE_CHOICE (เดี่ยว), MULTIPLE_CHOICE (หลายข้อ), TRUE_FALSE (ถูก/ผิด)\n` +
    `- ถ้าไม่ระบุประเภทให้ดูจากจำนวนคำตอบถูก: 1 = SINGLE_CHOICE, 2+ = MULTIPLE_CHOICE, ถูก/ผิด = TRUE_FALSE\n` +
    `- isCorrect: true สำหรับคำตอบที่ถูก\n` +
    `- explanation: คำอธิบายเฉลย (ถ้ามีในต้นฉบับ)\n\n` +
    `ข้อความ:\n${rawText}\n\n` +
    `ตอบในรูปแบบ JSON เท่านั้น:\n` +
    `{"questions":[{"type":"SINGLE_CHOICE","text":"คำถาม","explanation":"คำอธิบาย","options":[{"text":"ตัวเลือก","isCorrect":true},...]},...]}`;

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(80_000),
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw HttpError.badRequest(`AI parse failed: ${response.status} ${errText.slice(0, 120)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(content) as { questions?: unknown[] };
  const rawQuestions = parsed.questions ?? [];
  const ALLOWED_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']);

  const questions = rawQuestions.map((raw) => {
    const item = raw as {
      type?: string;
      text?: string;
      explanation?: string;
      options?: Array<{ text?: string; isCorrect?: boolean }>;
    };
    const type = ALLOWED_TYPES.has(item.type ?? '') ? (item.type as ImportType) : 'SINGLE_CHOICE';
    return CreateQuestionSchema.parse({
      type,
      difficulty: 'MEDIUM',
      defaultPoints: 1,
      text: item.text ?? '',
      explanation: item.explanation || undefined,
      options: (item.options ?? []).slice(0, 6).map((opt, index) => ({
        text: opt.text ?? '',
        isCorrect: Boolean(opt.isCorrect),
        orderIndex: index,
      })),
    });
  });

  return { ...keepValid(questions), provider: config.provider };
}

function generateLocalDrafts(input: {
  sourceText: string;
  count: number;
  difficulty: Difficulty;
}): CreateQuestionInput[] {
  const sentences = input.sourceText
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？])\s+|[\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30)
    .slice(0, Math.max(input.count, 1));
  const pool = sentences.length > 0 ? sentences : [input.sourceText.trim().slice(0, 220)];
  return Array.from({ length: input.count }, (_, index) => {
    const source = pool[index % pool.length] ?? input.sourceText.trim();
    const answer = source.length > 160 ? `${source.slice(0, 157)}...` : source;
    return {
      type: 'SINGLE_CHOICE',
      difficulty: input.difficulty,
      defaultPoints: 1,
      text: `จากเนื้อหาที่ให้มา ข้อใดสรุปสาระสำคัญได้ถูกต้องที่สุด (${index + 1})`,
      explanation: answer,
      options: [
        { text: answer, isCorrect: true, orderIndex: 0 },
        { text: 'เป็นข้อมูลที่ไม่เกี่ยวข้องกับเนื้อหาหลัก', isCorrect: false, orderIndex: 1 },
        { text: 'เป็นข้อสรุปที่ขัดแย้งกับเนื้อหาที่ให้มา', isCorrect: false, orderIndex: 2 },
        { text: 'เป็นรายละเอียดที่ยังไม่มีหลักฐานจากเนื้อหา', isCorrect: false, orderIndex: 3 },
      ],
    };
  });
}

function collectOptions(record: Record<string, string>, type: ImportType | null): string[] {
  if (type === 'TRUE_FALSE') {
    return [record.option_1 || 'ถูก', record.option_2 || 'ผิด'].map((v) => v.trim()).filter(Boolean);
  }
  return Array.from({ length: 10 }, (_, index) => record[`option_${index + 1}`]?.trim() ?? '').filter(Boolean);
}

function parseCorrectIndexes(raw: string | undefined, options: string[], type: ImportType | null): number[] {
  const value = (raw ?? '').trim();
  if (!value) return [];
  if (type === 'TRUE_FALSE') {
    if (/^(true|ถูก|yes|y|1|a)$/i.test(value)) return [0];
    if (/^(false|ผิด|no|n|0|b)$/i.test(value)) return [1];
  }
  return value
    .split(/[;,|]/)
    .map((part) => part.trim())
    .map((part) => {
      const letterIndex = LETTERS.indexOf(part.toUpperCase());
      if (letterIndex >= 0) return letterIndex;
      const numberIndex = Number(part) - 1;
      if (Number.isInteger(numberIndex) && numberIndex >= 0) return numberIndex;
      return options.findIndex((option) => option.trim() === part);
    })
    .filter((index, pos, arr) => index >= 0 && index < options.length && arr.indexOf(index) === pos);
}

function normalizeType(raw: string | undefined): ImportType | null {
  const value = (raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (value === 'SINGLE' || value === 'SINGLE_CHOICE') return 'SINGLE_CHOICE';
  if (value === 'MULTIPLE' || value === 'MULTIPLE_CHOICE') return 'MULTIPLE_CHOICE';
  if (value === 'TRUE_FALSE' || value === 'TRUE/FALSE' || value === 'TF') return 'TRUE_FALSE';
  return null;
}

function normalizeDifficulty(raw: string | undefined): Difficulty | null {
  const value = (raw ?? 'MEDIUM').trim().toUpperCase();
  if (value === 'EASY' || value === 'MEDIUM' || value === 'HARD') return value;
  return null;
}

function readExcelRow(row: ExcelJS.Row): string[] {
  const values: string[] = [];
  for (let i = 1; i <= row.cellCount; i += 1) {
    const cell = row.getCell(i);
    values.push(String(cell.text || cell.value || '').trim());
  }
  return values;
}

function toRecord(headers: string[], values: string[], rowNumber: number): Record<string, string> {
  const record: Record<string, string> = { __rowNumber: String(rowNumber) };
  headers.forEach((header, index) => {
    record[header] = values[index] ?? '';
  });
  return record;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

