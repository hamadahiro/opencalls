// Cloudflare Worker — deploy to opencalls-submit.monographica.workers.dev
// This proxies form submissions to GitHub Issues
//
// Setup:
// 1. Create a Cloudflare account at dash.cloudflare.com
// 2. Go to Workers & Pages → Create Worker
// 3. Name it: opencalls-submit
// 4. Paste this code
// 5. Add environment variable: GITHUB_TOKEN (your personal access token with 'repo' scope)
// 6. Deploy
//
// To create a GitHub token:
// 1. Go to github.com/settings/tokens
// 2. Generate new token (classic)
// 3. Select 'repo' scope
// 4. Copy the token and add it as GITHUB_TOKEN in Cloudflare Worker settings

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://opencalls.monographica.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const { title, body } = await request.json();

      const res = await fetch('https://api.github.com/repos/hamadahiro/opencalls/issues', {
        method: 'POST',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'opencalls-submit-worker',
        },
        body: JSON.stringify({
          title: title,
          body: body,
          labels: ['submission']
        })
      });

      if (res.ok) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ error: 'GitHub API error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
