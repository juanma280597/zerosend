import type { APIRoute } from 'astro';
import { tools } from '../data/tools';

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? 'https://zerosend.example';
  const paths = ['/', '/about', '/privacy', '/terms', ...tools.map((tool) => tool.href)];
  const urls = paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
