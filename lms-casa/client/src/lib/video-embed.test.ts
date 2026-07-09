import { describe, expect, it } from 'vitest';
import { getVideoEmbed } from './video-embed';

describe('getVideoEmbed', () => {
  it('returns null for empty/invalid input', () => {
    expect(getVideoEmbed(null)).toBeNull();
    expect(getVideoEmbed(undefined)).toBeNull();
    expect(getVideoEmbed('')).toBeNull();
    expect(getVideoEmbed('not a url')).toBeNull();
  });

  it('returns null for direct video file URLs', () => {
    expect(getVideoEmbed('https://cdn.example.com/video.mp4')).toBeNull();
    expect(getVideoEmbed('https://example.com/video.webm')).toBeNull();
  });

  it('detects youtube.com/watch?v=', () => {
    const out = getVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(out?.provider).toBe('youtube');
    expect(out?.embedUrl).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('detects youtu.be short URL', () => {
    const out = getVideoEmbed('https://youtu.be/dQw4w9WgXcQ');
    expect(out?.provider).toBe('youtube');
    expect(out?.embedUrl).toContain('/embed/dQw4w9WgXcQ');
  });

  it('detects youtube shorts', () => {
    const out = getVideoEmbed('https://www.youtube.com/shorts/abc123XYZ_-');
    expect(out?.provider).toBe('youtube');
    expect(out?.embedUrl).toContain('/embed/abc123XYZ_-');
  });

  it('passes start time from t= param (numeric)', () => {
    const out = getVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90');
    expect(out?.embedUrl).toContain('start=90');
  });

  it('parses t=1m30s format', () => {
    const out = getVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s');
    expect(out?.embedUrl).toContain('start=90');
  });

  it('detects vimeo.com', () => {
    const out = getVideoEmbed('https://vimeo.com/123456789');
    expect(out?.provider).toBe('vimeo');
    expect(out?.embedUrl).toBe('https://player.vimeo.com/video/123456789');
  });

  it('detects player.vimeo.com embed URL passthrough', () => {
    const out = getVideoEmbed('https://player.vimeo.com/video/123456789');
    expect(out?.provider).toBe('vimeo');
    expect(out?.embedUrl).toBe('https://player.vimeo.com/video/123456789');
  });

  it('returns null for vimeo without numeric id', () => {
    expect(getVideoEmbed('https://vimeo.com/categories/animation')).toBeNull();
  });

  it('whitelists modestbranding + rel=0', () => {
    const out = getVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(out?.embedUrl).toContain('rel=0');
    expect(out?.embedUrl).toContain('modestbranding=1');
  });
});
