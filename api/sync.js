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

    // Nếu không có KV, tự động commit lên GitHub
    try {
      // Lấy GitHub token từ environment variable
      const githubToken = process.env.GITHUB_TOKEN;
      const repoOwner = process.env.GITHUB_REPO_OWNER || 'ncdathwb';
      const repoName = process.env.GITHUB_REPO_NAME || 'ManagementLicense';
      const filePath = 'licenses.json';
      const branch = 'main';

      if (githubToken) {
        console.log(`[GITHUB] Attempting to commit to ${repoOwner}/${repoName}`);
        
        // 1. Lấy SHA của file hiện tại (nếu có)
        let currentSha = null;
        try {
          const getFileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;
          const getFileResponse = await fetch(getFileUrl, {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'License-Manager-Pro'
            }
          });

          if (getFileResponse.ok) {
            const fileData = await getFileResponse.json();
            currentSha = fileData.sha;
            console.log('[GITHUB] Found existing file, SHA:', currentSha);
          } else if (getFileResponse.status === 404) {
            console.log('[GITHUB] File does not exist, will create new file');
          } else {
            const errorData = await getFileResponse.json();
            console.error('[GITHUB] Error getting file:', getFileResponse.status, errorData);
          }
        } catch (e) {
          console.error('[GITHUB] Error getting file:', e.message);
        }

        // 2. Tạo nội dung file mới (base64 encoded)
        const fileContent = JSON.stringify(licenses, null, 2);
        const encodedContent = Buffer.from(fileContent).toString('base64');

        // 3. Commit file lên GitHub
        const commitMessage = `Auto-update licenses.json - ${new Date().toISOString()}`;
        
        const commitUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
        const commitBody = {
          message: commitMessage,
          content: encodedContent,
          branch: branch
        };

        // Nếu file đã tồn tại, cần thêm SHA để update
        if (currentSha) {
          commitBody.sha = currentSha;
        }

        console.log('[GITHUB] Committing file...');
        const commitResponse = await fetch(commitUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'License-Manager-Pro'
          },
          body: JSON.stringify(commitBody)
        });

        const commitResult = await commitResponse.json();

        if (commitResponse.ok) {
          console.log('[GITHUB] Commit successful:', commitResult.commit.sha);
          return res.status(200).json({ 
            success: true, 
            message: 'Licenses synced and committed to GitHub automatically',
            count: licenses.length,
            commit: {
              sha: commitResult.commit.sha,
              message: commitMessage,
              url: commitResult.commit.html_url
            }
          });
        } else {
          console.error('[GITHUB] API error:', commitResponse.status, commitResult);
          return res.status(200).json({ 
            success: false, 
            message: 'Sync successful but GitHub commit failed',
            count: licenses.length,
            error: commitResult.message || 'Unknown error',
            details: commitResult,
            github_status: commitResponse.status
          });
        }
      } else {
        // Không có GitHub token
        console.error('[GITHUB] GITHUB_TOKEN not configured');
        throw new Error('GITHUB_TOKEN not configured');
      }
    } catch (githubError) {
      // Nếu không thể commit GitHub, trả về JSON để download
      console.error('Error committing to GitHub:', githubError);
      return res.status(200).json({ 
        success: true, 
        message: 'Sync successful but auto-commit failed. Please download and commit manually.',
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

