// Vercel Serverless Function để verify license và trả về JSON
export default async function handler(req, res) {
  // Chỉ cho phép GET request
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { verify } = req.query;
  const normalizedKey = (verify || '').toString().trim().toUpperCase();

  if (!normalizedKey) {
    return res.status(400).json({ 
      valid: false, 
      message: 'Missing license key parameter' 
    });
  }

  try {
    // Đọc licenses: ƯU TIÊN Vercel KV (dữ liệu mới nhất từ sync), sau đó mới fallback về file JSON
    let licenses = [];
    
    // ƯU TIÊN: Đọc từ Vercel KV trước (dữ liệu được sync mới nhất)
    try {
      const { kv } = require('@vercel/kv');
      if (kv) {
        const kvData = await kv.get('licenses');
        if (kvData && Array.isArray(kvData) && kvData.length > 0) {
          licenses = kvData;
          console.log('[VERIFY] Loaded licenses from Vercel KV:', kvData.length);
        }
      }
    } catch (e) {
      // Vercel KV không khả dụng, sẽ fallback về file
      console.log('[VERIFY] Vercel KV not available, falling back to file:', e.message);
    }
    
    // FALLBACK: Nếu Vercel KV trống hoặc không có, đọc từ file JSON (trong repo)
    if (licenses.length === 0) {
      try {
        const fs = require('fs');
        const path = require('path');
        const licensesPath = path.join(process.cwd(), 'licenses.json');
        
        if (fs.existsSync(licensesPath)) {
          const data = fs.readFileSync(licensesPath, 'utf8');
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            licenses = parsed;
            console.log('[VERIFY] Loaded licenses from file:', parsed.length);
          }
        }
      } catch (fileError) {
        console.error('[VERIFY] Error reading licenses.json:', fileError);
      }
    }

    // Tìm license
    const license = licenses.find(
      (l) => (l.key || '').toString().trim().toUpperCase() === normalizedKey
    );
    const now = new Date();

    if (!license) {
      return res.status(200).json({
        valid: false,
        key: normalizedKey,
        status: 'expired',
        message: 'License không tồn tại',
        days_remaining: 0,
        timestamp: now.toISOString()
      });
    }

    // Tính toán trạng thái
    const expiry = new Date(license.expiry);
    const diffTime = expiry - now;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let status, valid;
    // Nếu days_remaining <= 0 (số âm hoặc 0) thì key hết hạn
    if (diffDays <= 0 || diffTime <= 0) {
      status = 'expired';
      valid = false;
    } else if (diffDays <= 7) {
      status = 'expiring';
      valid = true;
    } else {
      status = 'valid';
      valid = true;
    }

    // Chuẩn hóa status cho app.py
    // app.py kiểm tra: status in ("active", "đang hoạt động", "") thì hợp lệ
    const apiStatus = valid && status !== 'expired' ? 'active' : status;

    const result = {
      valid: valid,
      key: license.key,
      expiry: license.expiry,
      status: apiStatus,
      message: valid
        ? status === 'expiring'
          ? 'License sắp hết hạn'
          : 'License hợp lệ'
        : 'License đã hết hạn',
      days_remaining: diffDays,
      note: license.note || '',
      timestamp: now.toISOString()
    };

    // Set Content-Type header
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error verifying license:', error);
    return res.status(500).json({
      valid: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

