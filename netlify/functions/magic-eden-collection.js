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
    const collection = queryParams.collection;
    const sortBy = queryParams.sortBy || 'floorAskPrice';
    const limit = queryParams.limit || '50';

    if (!collection) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Collection parameter is required' }),
      };
    }

    const url = `${MAGIC_EDEN_BASE_URL}/tokens/v6?collection=${collection.toLowerCase()}&sortBy=${sortBy}&limit=${limit}&includeTopBid=false&excludeEOA=false&includeAttributes=false&includeQuantity=false&includeDynamicPricing=false&includeLastSale=false&normalizeRoyalties=false`;
    
    console.log('Fetching from Magic Eden:', url);

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
    console.error('Error in magic-eden-collection function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch from Magic Eden API',
        details: error.message || 'Unknown error'
      }),
    };
  }
};
