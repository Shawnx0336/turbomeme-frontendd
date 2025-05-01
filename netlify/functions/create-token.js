// netlify/functions/create-token.js
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { createMint } = require('@solana/spl-token');
const { createClient } = require('@supabase/supabase-js');
const { Readable } = require('stream');
const formidable = require('formidable');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse multipart form data
    const form = new formidable.IncomingForm();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(event.body, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const { name, symbol, supply, decimals, walletAddress, renounceMint, allowFreeze, treasuryFee } = fields;
    const image = files.image;

    // Connect to Solana devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Temporary keypair for paying fees (for devnet testing only)
    const payer = Keypair.generate();
    const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2e9); // 2 SOL
    await connection.confirmTransaction(airdropSignature);

    // User's wallet as mint authority
    const authority = new PublicKey(walletAddress);

    // Create the SPL token mint
    const mint = await createMint(
      connection,
      payer, // Payer of the transaction fees
      authority, // Mint authority
      allowFreeze === 'true' ? authority : null, // Freeze authority
      parseInt(decimals) // Decimals
    );

    // Handle image upload (if provided)
    let imageUrl = null;
    if (image) {
      const fileBuffer = Buffer.from(image.path); // Read the uploaded file
      const fileStream = Readable.from(fileBuffer);
      const fileName = `${Date.now()}-${name}.${image.mimetype.split('/')[1]}`; // e.g., timestamp-TurboMeme.png
      const { data, error } = await supabase.storage
        .from('token-images')
        .upload(fileName, fileStream, {
          contentType: image.mimetype,
        });

      if (error) throw new Error('Failed to upload image: ' + error.message);

      // Get the public URL of the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from('token-images')
        .getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;
    }

    // Save token launch to Supabase
    const { data, error } = await supabase
      .from('token_launches')
      .insert({
        name,
        symbol,
        address: mint.toBase58(),
        wallet_address: walletAddress,
        image_url: imageUrl,
        timestamp: new Date().toISOString(),
      });

    if (error) throw new Error('Failed to save token launch: ' + error.message);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        mint: mint.toBase58(),
        imageUrl,
      }),
    };
  } catch (error) {
    console.error('Token creation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Failed to create token: ' + error.message }),
    };
  }
};
