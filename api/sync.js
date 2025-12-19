// Vercel Serverless Function để sync licenses từ localStorage vào storage
export default async function handler(req, res) {
  // Chỉ cho phép POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { licenses } = req.body;

    if (!Array.isArray(licenses)) {
      return res.status(400).json({ 
        error: 'Invalid request body. Expected licenses array.' 
      });
    }

    // Lưu vào Vercel KV (nếu có) hoặc file JSON
    try {
      const { kv } = require('@vercel/kv');
      if (kv) {
        await kv.set('licenses', licenses);
        return res.status(200).json({ 
          success: true, 
          message: 'Licenses synced to Vercel KV',
          count: licenses.length
        });
      }
    } catch (e) {
      // Fallback: không thể dùng KV, trả về thông báo
      console.error('Vercel KV not available:', e);
    }

    // Nếu không có KV, thử ghi vào file licenses.json
    try {
      const fs = require('fs');
      const path = require('path');
      const licensesPath = path.join(process.cwd(), 'licenses.json');
      
      // Ghi file licenses.json
      fs.writeFileSync(licensesPath, JSON.stringify(licenses, null, 2), 'utf8');
      
      return res.status(200).json({ 
        success: true, 
        message: 'Licenses synced to licenses.json file',
        count: licenses.length,
        file_path: licensesPath
      });
    } catch (fileError) {
      // Nếu không thể ghi file (ví dụ: read-only filesystem trên Vercel), trả về JSON để commit thủ công
      console.error('Cannot write licenses.json file:', fileError);
      return res.status(200).json({ 
        success: true, 
        message: 'Please commit licenses.json to Git',
        licenses: licenses,
        note: 'Save the licenses array above to licenses.json file',
        json_content: JSON.stringify(licenses, null, 2)
      });
    }
  } catch (error) {
    console.error('Error syncing licenses:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

