// netlify/functions/recent-launches.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { data, error } = await supabase
      .from('token_launches')
      .select('name, symbol, address, image_url, timestamp')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) throw new Error('Failed to fetch recent launches: ' + error.message);

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Fetch Recent Launches Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch recent launches: ' + error.message }),
    };
  }
};
