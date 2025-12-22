export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { licenses, message } = req.body;

    if (!Array.isArray(licenses)) {
      return res.status(400).json({ 
        error: 'Invalid request body. Expected licenses array.' 
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('GITHUB_TOKEN not configured');
      return res.status(500).json({
        error: 'GitHub token not configured',
        message: 'Please set GITHUB_TOKEN environment variable in Vercel'
      });
    }

    const repoOwner = process.env.GITHUB_REPO_OWNER || 'ncdathwb';
    const repoName = process.env.GITHUB_REPO_NAME || 'ManagementLicense';
    const filePath = 'licenses.json';
    const branch = 'main';

    let currentSha = null;
    try {
      const getFileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;
      const getFileResponse = await fetch(getFileUrl, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'License-Manager-Pro'
        }
      });

      if (getFileResponse.ok) {
        const fileData = await getFileResponse.json();
        currentSha = fileData.sha;
      }
    } catch (e) {
      console.log('File does not exist or error getting file:', e.message);
    }

    const fileContent = JSON.stringify(licenses, null, 2);
    const encodedContent = Buffer.from(fileContent).toString('base64');

    const commitMessage = message || `Auto-update licenses.json - ${new Date().toISOString()}`;
    
    const commitUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
    const commitBody = {
      message: commitMessage,
      content: encodedContent,
      branch: branch
    };

    if (currentSha) {
      commitBody.sha = currentSha;
    }

    const commitResponse = await fetch(commitUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'License-Manager-Pro'
      },
      body: JSON.stringify(commitBody)
    });

    const commitResult = await commitResponse.json();

    if (!commitResponse.ok) {
      console.error('GitHub API error:', commitResult);
      return res.status(commitResponse.status).json({
        error: 'Failed to commit to GitHub',
        message: commitResult.message || 'Unknown error',
        details: commitResult
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Licenses.json committed to GitHub successfully',
      count: licenses.length,
      commit: {
        sha: commitResult.commit.sha,
        message: commitMessage,
        url: commitResult.commit.html_url
      }
    });

  } catch (error) {
    console.error('Error committing to GitHub:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
