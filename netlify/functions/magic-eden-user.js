const MAGIC_EDEN_BASE_URL = "https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet";
const MAGIC_EDEN_API_KEY = process.env.MAGIC_EDEN_API_KEY;

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!MAGIC_EDEN_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Magic Eden API key not configured' }),
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const userAddress = queryParams.userAddress;
    const limit = queryParams.limit || '50';

    if (!userAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User address parameter is required' }),
      };
    }

    const url = `${MAGIC_EDEN_BASE_URL}/users/${userAddress}/tokens/v7?normalizeRoyalties=false&sortBy=acquiredAt&sortDirection=desc&limit=${limit}&includeTopBid=false&includeAttributes=false&includeLastSale=false&includeRawData=false&filterSpamTokens=false&useNonFlaggedFloorAsk=false`;
    
    console.log('Fetching user NFTs from Magic Eden:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${MAGIC_EDEN_API_KEY}`,
        'accept': '*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`Magic Eden API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error in magic-eden-user function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch user NFTs from Magic Eden API',
        details: error.message || 'Unknown error'
      }),
    };
  }
};
