import fs from 'node:fs';
import type { Request, Response } from 'express';
import { audit } from '../../utils/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { matchesSignature, readHeader } from '../../utils/fileSignature.js';
import { AntiAfkSchema, BrandingSchema } from './settings.schema.js';
import * as service from './settings.service.js';

export async function getBranding(_req: Request, res: Response): Promise<void> {
  res.json({ branding: await service.getBranding() });
}

export async function updateBranding(req: Request, res: Response): Promise<void> {
  const input = BrandingSchema.parse(req.body);
  const branding = await service.updateBranding(input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'settings.branding.update',
    entityType: 'setting',
    entityId: 'system.branding',
    changes: input,
    req,
  });
  res.json({ branding });
}

export async function getAntiAfk(_req: Request, res: Response): Promise<void> {
  res.json({ antiAfk: await service.getAntiAfk() });
}

export async function updateAntiAfk(req: Request, res: Response): Promise<void> {
  const input = AntiAfkSchema.parse(req.body);
  const antiAfk = await service.updateAntiAfk(input);
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'settings.anti_afk.update',
    entityType: 'setting',
    entityId: 'learning.anti_afk',
    changes: input,
    req,
  });
  res.json({ antiAfk });
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Logo file is required' } });
    return;
  }
  if (!matchesSignature(readHeader(file.path), ['png', 'jpeg', 'webp'])) {
    fs.unlinkSync(file.path);
    throw HttpError.badRequest('Logo must be PNG, JPG, or WEBP');
  }
  const current = await service.getBranding();
  const logoUrl = `/uploads/branding/${file.filename}`;
  const branding = await service.updateBranding({ ...current, logoUrl });
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'settings.branding.logo.upload',
    entityType: 'setting',
    entityId: 'system.branding',
    metadata: { filename: file.filename, mimeType: file.mimetype, size: file.size },
    req,
  });
  res.status(201).json({ branding });
}
