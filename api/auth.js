console.info(`[prompt-optimizer/runtime] Node.js ${process.version}`);

export default function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const accessPassword = process.env.ACCESS_PASSWORD;
  
  // 如果没有设置密码，直接返回成功
  if (!accessPassword) {
    return res.status(200).json({ 
      success: true, 
      message: 'No password protection configured' 
    });
  }

  if (req.method === 'POST') {
    const { password, action } = req.body;
    
    if (action === 'verify') {
      if (password === accessPassword) {
        // 设置Cookie以记住用户身份验证状态
        const maxAge = 60 * 60 * 24 * 7; // 7天
        res.setHeader('Set-Cookie', [
          `vercel_access_token=${accessPassword}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
        ]);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Authentication successful' 
        });
      } else {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid password' 
        });
      }
    }
  }

  if (req.method === 'GET') {
    const { action } = req.query;
    
    if (action === 'logout') {
      // 清除Cookie
      res.setHeader('Set-Cookie', [
        'vercel_access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
      ]);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Logged out successfully' 
      });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
