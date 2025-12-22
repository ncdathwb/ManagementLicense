// Vercel Serverless Function để proxy licenses.json từ GitHub (tránh CORS)
export default async function handler(req, res) {
  // Chỉ cho phép GET request
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const owner = process.env.GITHUB_REPO_OWNER || 'ncdathwb';
    const repo = process.env.GITHUB_REPO_NAME || 'ManagementLicense';
    const branch = process.env.GITHUB_REPO_BRANCH || 'main';
    
    // Thử lấy từ GitHub API trước (có thể có token để tránh rate limit)
    const githubToken = process.env.GITHUB_TOKEN;
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/licenses.json?ref=${branch}`;
    
    let licenses = [];
    let useRawUrl = false;
    
    // Nếu có token, dùng GitHub API (không bị rate limit nhiều)
    if (githubToken) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const apiResponse = await fetch(githubApiUrl, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'License-Manager-Pro'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (apiResponse.ok) {
          const fileData = await apiResponse.json();
          // Decode base64 content
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            licenses = parsed;
            console.log('[LICENSES API] Loaded from GitHub API:', licenses.length);
          }
        } else {
          useRawUrl = true;
        }
      } catch (apiError) {
        console.log('[LICENSES API] GitHub API failed, trying raw URL:', apiError.message);
        useRawUrl = true;
      }
    } else {
      useRawUrl = true;
    }
    
    // Fallback: dùng raw URL nếu API không có token hoặc fail
    if (useRawUrl && licenses.length === 0) {
      const githubRawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/licenses.json`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      
      try {
        const rawResponse = await fetch(githubRawUrl, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (rawResponse.ok) {
          const text = await rawResponse.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            licenses = parsed;
            console.log('[LICENSES API] Loaded from GitHub raw:', licenses.length);
          }
        } else if (rawResponse.status === 404) {
          // File chưa tồn tại, trả về mảng rỗng
          licenses = [];
          console.log('[LICENSES API] File not found on GitHub, returning empty array');
        } else {
          throw new Error(`GitHub raw returned status ${rawResponse.status}`);
        }
      } catch (rawError) {
        clearTimeout(timeoutId);
        if (rawError.name === 'AbortError') {
          console.log('[LICENSES API] GitHub raw fetch timeout');
        } else {
          throw rawError;
        }
      }
    }
    
    // Set CORS headers để cho phép client-side fetch
    // Đảm bảo KHÔNG CACHE - Luôn trả về dữ liệu mới nhất
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json');
    
    // Thêm timestamp vào response để client biết đây là dữ liệu mới
    const responseData = {
        licenses: licenses,
        timestamp: new Date().toISOString(),
        count: licenses.length
    };
    
    return res.status(200).json(licenses); // Trả về array trực tiếp để tương thích với code hiện tại
    
  } catch (error) {
    console.error('[LICENSES API] Error:', error);
    
    // Set CORS headers ngay cả khi lỗi
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    // Trả về mảng rỗng thay vì lỗi để app vẫn hoạt động
    return res.status(200).json([]);
  }
}

