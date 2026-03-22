import type { APIRoute } from 'astro';

export const prerender = false;

const SP_URL =
  'https://reports.suomenpankki.fi/WebForms/ReportViewerPage.aspx' +
  '?report=/tilastot/markkina-_ja_hallinnolliset_korot/euribor_korot_xml_short_en&output=xml';

export const GET: APIRoute = async () => {
  const upstream = await fetch(SP_URL);
  if (!upstream.ok) {
    return new Response('upstream error', { status: 502 });
  }
  const xml = await upstream.text();
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
