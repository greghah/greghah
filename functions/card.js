const VCARD = `BEGIN:VCARD
VERSION:3.0
N:Hah;Greg;;;
FN:Greg Hah
ORG:Freelance IT & Web
TITLE:Freelance IT & Web
TEL;TYPE=CELL:+1 585 333 0388
URL:https://greghah.com
END:VCARD
`;

export async function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        Allow: 'GET, HEAD'
      }
    });
  }

  return new Response(request.method === 'HEAD' ? null : VCARD, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="greg-hah.vcf"',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
