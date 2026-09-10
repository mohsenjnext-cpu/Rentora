// Netlify Serverless Function for Pi Network Token Verification
// Route: /.netlify/functions/pi-login or /api/auth/pi-login

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { accessToken, username, uid } = JSON.parse(event.body || '{}');

    if (!accessToken) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing Pi access token' })
      };
    }

    let verifiedUser = {
      uid: uid || ('pi_usr_' + (username || 'pioneer')),
      username: username || 'pioneer'
    };
    let verifiedWithPiApi = false;

    // Call official Pi Network Verification endpoint
    try {
      const piRes = await fetch('https://api.minepi.com/v2/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (piRes.ok) {
        const piData = await piRes.json();
        verifiedUser = {
          uid: piData.uid || verifiedUser.uid,
          username: piData.username || verifiedUser.username
        };
        verifiedWithPiApi = true;
      }
    } catch (piErr) {
      console.warn('[Netlify Function] Pi API verification note:', piErr.message);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        user: verifiedUser,
        verifiedWithPiApi,
        sessionToken: 'session_' + Math.random().toString(36).substring(2, 12)
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
}
