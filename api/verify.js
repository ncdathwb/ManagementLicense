// Vercel Serverless Function để verify license và trả về JSON
// Static fallback to ensure license list luôn có sẵn (dù KV hay fs lỗi)
let staticFallbackLicenses = [];
try {
  staticFallbackLicenses = require('../licenses.json');
} catch (e) {
  staticFallbackLicenses = [];
}

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
    // Đọc licenses: kết hợp KV, file, và static fallback để tránh mất key khi KV chưa sync
    let licensesFromKv = [];
    let licensesFromFile = [];
    let licensesFromGitHub = [];
    const licensesFromStatic = Array.isArray(staticFallbackLicenses) ? staticFallbackLicenses : [];

    // 1) Đọc từ Vercel KV (nếu có)
    try {
      const { kv } = require('@vercel/kv');
      if (kv) {
        const kvData = await kv.get('licenses');
        if (kvData && Array.isArray(kvData) && kvData.length > 0) {
          licensesFromKv = kvData;
          console.log('[VERIFY] Loaded licenses from Vercel KV:', kvData.length);
        }
      }
    } catch (e) {
      console.log('[VERIFY] Vercel KV not available, will still read file:', e.message);
    }

    // 2) Đọc từ file JSON trong repo (để đảm bảo luôn có key gốc)
    try {
      const fs = require('fs');
      const path = require('path');
      const licensesPath = path.join(process.cwd(), 'licenses.json');

      if (fs.existsSync(licensesPath)) {
        const data = fs.readFileSync(licensesPath, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          licensesFromFile = parsed;
          console.log('[VERIFY] Loaded licenses from file:', parsed.length);
        }
      }
    } catch (fileError) {
      console.error('[VERIFY] Error reading licenses.json:', fileError);
    }

    // 3) Đọc từ GitHub raw (public) để lấy bản mới nhất nếu KV chưa có hoặc sync GitHub thất bại
    try {
      // Sử dụng global fetch (có sẵn trong Node 18+ và Vercel)
      const owner = process.env.GITHUB_REPO_OWNER || 'ncdathwb';
      const repo = process.env.GITHUB_REPO_NAME || 'ManagementLicense';
      const branch = process.env.GITHUB_REPO_BRANCH || 'main';
      const githubUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/licenses.json`;
      
      // Thêm timeout với AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      
      try {
        const ghResp = await fetch(githubUrl, { 
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        clearTimeout(timeoutId);
        
        if (ghResp.ok) {
          const ghText = await ghResp.text();
          const ghJson = JSON.parse(ghText);
          if (Array.isArray(ghJson) && ghJson.length > 0) {
            licensesFromGitHub = ghJson;
            console.log('[VERIFY] Loaded licenses from GitHub raw:', ghJson.length);
          }
        } else {
          console.log('[VERIFY] GitHub raw fetch status:', ghResp.status);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.log('[VERIFY] GitHub fetch timeout after 7 seconds');
        } else {
          throw fetchError;
        }
      }
    } catch (e) {
      console.log('[VERIFY] Cannot load licenses from GitHub raw:', e.message);
    }

    // 3) Gộp: So sánh timestamp để ưu tiên version mới hơn (giống logic trong index.html)
    // Đảm bảo dữ liệu mới nhất từ mọi nguồn đều được giữ lại
    const licenseMap = new Map();
    
    // Thêm tất cả licenses vào map, so sánh timestamp nếu trùng key
    [...licensesFromStatic, ...licensesFromFile, ...licensesFromGitHub, ...licensesFromKv].forEach(lic => {
      if (lic && lic.key) {
        const key = String(lic.key).trim().toUpperCase();
        const existing = licenseMap.get(key);
        
        if (!existing) {
          // Key chưa có, thêm vào
          licenseMap.set(key, lic);
        } else {
          // Key đã có, so sánh timestamp để giữ version mới hơn
          const existingUpdated = existing.updated ? new Date(existing.updated).getTime() : 0;
          const licUpdated = lic.updated ? new Date(lic.updated).getTime() : 0;
          
          // Nếu license mới hơn (updated timestamp lớn hơn), thay thế
          if (licUpdated > existingUpdated) {
            licenseMap.set(key, lic);
            console.log(`[VERIFY] Merged: Keeping newer version of key ${key} (${lic.updated} vs ${existing.updated})`);
          }
        }
      }
    });
    
    const licenses = Array.from(licenseMap.values());

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
    // Hết hạn khi đã qua thời điểm hết hạn (diffTime <= 0)
    if (diffTime <= 0) {
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

