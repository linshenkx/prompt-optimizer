// 简单的内存速率限制
const rateLimit = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15分钟
const crypto = require('crypto');

// 生成安全的随机token
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// 生成带盐的安全访问令牌
function generateAccessToken(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const payload = `${password}:${salt}:${timestamp}`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return `${salt}:${timestamp}:${hash}`;
}

// 验证访问令牌
function verifyAccessToken(token, password) {
  if (!token || !password) return false;
  
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  
  const [salt, timestamp, hash] = parts;
  
  // 检查令牌时效性（7天）
  const tokenAge = Date.now() - parseInt(timestamp);
  if (tokenAge > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }
  
  // 验证哈希
  const expectedHash = crypto.createHash('sha256').update(`${password}:${salt}:${timestamp}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

// 检查速率限制
function checkRateLimit(ip) {
  const now = Date.now();
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 0, resetTime: now + WINDOW_MS });
  }
  
  const clientData = rateLimit.get(ip);
  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + WINDOW_MS;
  }
  
  if (clientData.count >= MAX_ATTEMPTS) {
    return false;
  }
  
  clientData.count++;
  return true;
}

// 配置CORS
function setCORSHeaders(req, res) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5173'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // 不允许未知源，返回403
    return res.status(403).set('Content-Type', 'text/plain').end('Forbidden');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// 设置安全的cookie
function setSecureCookie(req, name, value, maxAge) {
  const isSecure = process.env.NODE_ENV === 'production' || 
                   process.env.VERCEL_ENV === 'production' ||
                   req.headers['x-forwarded-proto'] === 'https';
  
  const cookieOptions = [
    `${name}=${value}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax'
  ];
  
  if (isSecure) {
    cookieOptions.push('Secure');
  }
  
  return cookieOptions.join('; ');
}

export default function handler(req, res) {
  // 设置CORS头
  setCORSHeaders(req, res);
  
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

  // 获取客户端IP
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if (req.method === 'POST') {
    const { password, action, csrfToken } = req.body;
    
    if (action === 'verify') {
      // 检查速率限制
      if (!checkRateLimit(clientIP)) {
        return res.status(429).json({ 
          success: false, 
          message: 'Too many attempts. Please try again later.' 
        });
      }
      
      // 验证CSRF token（从Cookie或Header获取）
      const storedCSRFToken = req.cookies?.csrf_token;
      const requestCSRFToken = req.headers['x-csrf-token'] || req.body?.csrfToken;
      
      if (storedCSRFToken && storedCSRFToken !== requestCSRFToken) {
        return res.status(403).json({ 
          success: false, 
          message: 'Invalid CSRF token' 
        });
      }
      
      if (password === accessPassword) {
        // 生成带盐的安全访问令牌
        const accessToken = generateAccessToken(accessPassword);
        const maxAge = 60 * 60 * 24 * 7; // 7天
        
        // 设置访问令牌cookie（HttpOnly）
        res.setHeader('Set-Cookie', [
          setSecureCookie(req, 'vercel_access_token', accessToken, maxAge)
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
        'vercel_access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
        'csrf_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
      ]);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Logged out successfully' 
      });
    }
    
    if (action === 'csrf') {
      // 生成新的CSRF token（非HttpOnly，前端可读取）
      const csrfToken = generateSecureToken(16);
      const isSecure = process.env.NODE_ENV === 'production' || 
                       process.env.VERCEL_ENV === 'production' ||
                       req.headers['x-forwarded-proto'] === 'https';
      
      const cookieOptions = [
        `csrf_token=${csrfToken}`,
        'Path=/',
        `Max-Age=${60 * 60 * 24}`, // 24小时
        'SameSite=Lax'
      ];
      
      if (isSecure) {
        cookieOptions.push('Secure');
      }
      
      res.setHeader('Set-Cookie', cookieOptions.join('; '));
      
      return res.status(200).json({ 
        success: true, 
        csrfToken: csrfToken 
      });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
} 