export default async function handler(req, res) {
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

    const validatedLicenses = [];
    const seenKeys = new Set();
    
    for (const lic of licenses) {
      if (!lic || typeof lic !== 'object') {
        console.warn('[SYNC] Skipping invalid license (not an object):', lic);
        continue;
      }
      
      if (!lic.key || typeof lic.key !== 'string' || !lic.key.trim()) {
        console.warn('[SYNC] Skipping license without valid key:', lic);
        continue;
      }
      
      const normalizedKey = String(lic.key).trim().toUpperCase();
      if (seenKeys.has(normalizedKey)) {
        console.warn(`[SYNC] Skipping duplicate key: ${normalizedKey}`);
        continue;
      }
      seenKeys.add(normalizedKey);
      
      if (!lic.expiry) {
        console.warn(`[SYNC] License ${normalizedKey} missing expiry date`);
        continue;
      }
      
      const expiryDate = new Date(lic.expiry);
      if (isNaN(expiryDate.getTime())) {
        console.warn(`[SYNC] License ${normalizedKey} has invalid expiry date: ${lic.expiry}`);
        continue;
      }
      
      const validatedLic = {
        key: normalizedKey,
        expiry: expiryDate.toISOString(),
        note: lic.note || '',
        created: lic.created || new Date().toISOString(),
        updated: lic.updated || new Date().toISOString()
      };
      
      validatedLicenses.push(validatedLic);
    }
    
    if (validatedLicenses.length === 0 && licenses.length > 0) {
      return res.status(400).json({
        error: 'No valid licenses found after validation',
        message: 'All licenses failed validation. Please check the format.'
      });
    }
    
    if (validatedLicenses.length < licenses.length) {
      console.warn(`[SYNC] Validated ${validatedLicenses.length} out of ${licenses.length} licenses`);
    }
    
    const licensesToSync = validatedLicenses;

    try {
      const { kv } = require('@vercel/kv');
      if (kv) {
        await kv.set('licenses', licensesToSync);
        return res.status(200).json({ 
          success: true, 
          message: 'Licenses synced to Vercel KV',
          count: licensesToSync.length
        });
      }
    } catch (e) {
      console.error('Vercel KV not available:', e);
    }

    try {
      const githubToken = process.env.GITHUB_TOKEN;
      const repoOwner = process.env.GITHUB_REPO_OWNER || 'ncdathwb';
      const repoName = process.env.GITHUB_REPO_NAME || 'ManagementLicense';
      const filePath = 'licenses.json';
      const branch = 'main';

      if (githubToken) {
        console.log(`[GITHUB] Attempting to commit to ${repoOwner}/${repoName}`);
        
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
          } else if (getFileResponse.status === 429) {
            const retryAfter = getFileResponse.headers.get('Retry-After');
            console.error(`[GITHUB] Rate limit exceeded (429). Retry after: ${retryAfter || 'unknown'} seconds`);
            return res.status(429).json({
              success: false,
              error: 'GitHub API rate limit exceeded',
              message: `Rate limit exceeded. Please retry after ${retryAfter || 'some'} seconds.`,
              retry_after: retryAfter ? parseInt(retryAfter) : null
            });
          } else {
            let errorData = {};
            try {
              errorData = await getFileResponse.json();
            } catch (e) {
              errorData = { message: 'Unknown error' };
            }
            console.error('[GITHUB] Error getting file:', getFileResponse.status, errorData);
          }
        } catch (e) {
          console.error('[GITHUB] Error getting file:', e.message);
        }

        const fileContent = JSON.stringify(licensesToSync, null, 2);
        const encodedContent = Buffer.from(fileContent).toString('base64');

        const commitMessage = `Auto-update licenses.json - ${new Date().toISOString()}`;
        
        const commitUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
        const commitBody = {
          message: commitMessage,
          content: encodedContent,
          branch: branch
        };

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
            count: licensesToSync.length,
            commit: {
              sha: commitResult.commit.sha,
              message: commitMessage,
              url: commitResult.commit.html_url
            }
          });
        } else if (commitResponse.status === 429) {
          const retryAfter = commitResponse.headers.get('Retry-After');
          console.error(`[GITHUB] Rate limit exceeded (429). Retry after: ${retryAfter || 'unknown'} seconds`);
          return res.status(429).json({
            success: false,
            error: 'GitHub API rate limit exceeded',
            message: `Rate limit exceeded. Please retry after ${retryAfter || 'some'} seconds.`,
            count: licensesToSync.length,
            retry_after: retryAfter ? parseInt(retryAfter) : null
          });
        } else {
          console.error('[GITHUB] API error:', commitResponse.status, commitResult);
          
          if (commitResponse.status === 409 || (commitResult.message && commitResult.message.includes('sha'))) {
            console.warn('[GITHUB] SHA conflict detected, file may have been updated by another device');
            return res.status(200).json({ 
              success: false, 
              message: 'Sync failed due to concurrent update. Please try again.',
              count: licensesToSync.length,
              error: 'Concurrent update detected',
              details: commitResult,
              github_status: commitResponse.status,
              retry: true
            });
          }
          
          return res.status(200).json({ 
            success: false, 
            message: 'Sync successful but GitHub commit failed',
            count: licensesToSync.length,
            error: commitResult.message || 'Unknown error',
            details: commitResult,
            github_status: commitResponse.status
          });
        }
      } else {
        console.error('[GITHUB] GITHUB_TOKEN not configured');
        throw new Error('GITHUB_TOKEN not configured');
      }
    } catch (githubError) {
      console.error('Error committing to GitHub:', githubError);
      return res.status(200).json({ 
        success: true, 
        message: 'Sync successful but auto-commit failed. Please download and commit manually.',
        licenses: licensesToSync,
        note: 'Save the licenses array above to licenses.json file',
        json_content: JSON.stringify(licensesToSync, null, 2)
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
