const crypto = require('crypto');

export const config = {
  matcher: [
    /*
     * 匹配除以下路径之外的所有路径:
     * - api routes (以 /api/ 开头)
     * - 静态文件 (以 . 结尾)
     * - 其他静态资源
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets/|.*\\.).*)' 
  ],
};

// 验证访问令牌
function verifyAccessToken(cookieHeader) {
  const accessPassword = process.env.ACCESS_PASSWORD;
  
  // 如果没有设置密码，直接通过
  if (!accessPassword) {
    return true;
  }
  
  if (!cookieHeader) {
    return false;
  }
  
  const cookies = cookieHeader.split(';');
  const accessTokenCookie = cookies.find(cookie => 
    cookie.trim().startsWith('vercel_access_token=')
  );
  
  if (!accessTokenCookie) {
    return false;
  }
  
  const accessToken = accessTokenCookie.split('=')[1];
  
  // 验证令牌格式
  if (!accessToken || accessToken.length !== 64) {
    return false;
  }
  
  // 验证令牌是否匹配密码的哈希
  const expectedToken = crypto.createHash('sha256').update(accessPassword).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(accessToken, 'hex'), Buffer.from(expectedToken, 'hex'));
  } catch (error) {
    return false;
  }
}

// 添加安全头
function addSecurityHeaders(headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 访问环境变量
  const accessPassword = process.env.ACCESS_PASSWORD;
  
  // 如果没有设置密码，直接允许访问
  if (!accessPassword) {
    return; // 什么都不返回，表示继续处理请求
  }

  // 检查认证状态
  const cookieHeader = request.headers.get('cookie');
  const authenticated = verifyAccessToken(cookieHeader);
  
  // 如果已认证，允许访问并添加安全头
  if (authenticated) {
    const response = new Response(null, {
      status: 200,
      headers: new Headers(request.headers),
    });
    addSecurityHeaders(response.headers);
    return response;
  }

  // 获取浏览器语言设置
  const acceptLanguage = request.headers.get('accept-language') || '';
  const preferChinese = acceptLanguage.includes('zh');

  // 未认证，返回认证页面
  const response = new Response(generateAuthPage(preferChinese), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
  
  // 添加安全头
  addSecurityHeaders(response.headers);
  
  return response;
}

function generateAuthPage(isChinese = true) {
  // 语言文本对象
  const text = {
    title: isChinese ? '访问验证 - Prompt Optimizer' : 'Access Verification - Prompt Optimizer',
    heading: 'Prompt Optimizer',
    subtitle: isChinese ? '此站点受密码保护' : 'This site is password protected',
    passwordLabel: isChinese ? '访问密码' : 'Access Password',
    passwordPlaceholder: isChinese ? '请输入访问密码' : 'Enter access password',
    submitButton: isChinese ? '验证并访问' : 'Verify & Access',
    loading: isChinese ? '验证中，请稍候...' : 'Verifying, please wait...',
    footer: isChinese ? '安全访问控制 | Powered by Vercel' : 'Secure Access Control | Powered by Vercel',
    errorNetwork: isChinese ? '网络错误，请重试' : 'Network error, please try again',
  };

  return `
<!DOCTYPE html>
<html lang="${isChinese ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${text.title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
        }
        
        .auth-modal {
            background: white;
            padding: 2.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 400px;
            text-align: center;
            animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .logo {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #667eea;
        }
        
        h1 {
            font-size: 1.5rem;
            color: #333;
            margin-bottom: 0.5rem;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
            text-align: left;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            color: #333;
            font-weight: 500;
        }
        
        input[type="password"] {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e1e5e9;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        
        input[type="password"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .submit-btn {
            width: 100%;
            padding: 0.75rem;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .submit-btn:hover:not(:disabled) {
            background: #5a6fd8;
        }
        
        .submit-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .error-message {
            color: #e74c3c;
            margin-top: 1rem;
            font-size: 0.9rem;
            display: none;
            padding: 0.5rem;
            background: #ffeaea;
            border-radius: 4px;
            border-left: 4px solid #e74c3c;
        }
        
        .loading {
            display: none;
            margin-top: 1rem;
            color: #667eea;
        }
        
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            font-size: 0.8rem;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="auth-modal">
        <div class="logo">🚀</div>
        <h1>${text.heading}</h1>
        <p class="subtitle">${text.subtitle}</p>
        
        <form id="authForm">
            <div class="form-group">
                <label for="password">${text.passwordLabel}</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    required 
                    placeholder="${text.passwordPlaceholder}"
                    autocomplete="current-password"
                >
            </div>
            
            <button type="submit" class="submit-btn" id="submitBtn">
                <span id="btnText">${text.submitButton}</span>
            </button>
            
            <div class="error-message" id="errorMessage"></div>
            <div class="loading" id="loading">${text.loading}</div>
        </form>
        
        <div class="footer">
            ${text.footer}
        </div>
    </div>

    <script>
        const form = document.getElementById('authForm');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const errorMessage = document.getElementById('errorMessage');
        const loading = document.getElementById('loading');
        const passwordInput = document.getElementById('password');
        
        // 语言设置
        const isChinese = document.documentElement.lang === 'zh-CN';
        const errorMessages = {
            network: '${text.errorNetwork}',
            invalidPassword: isChinese ? '密码错误，请重试' : 'Invalid password, please try again',
            tooManyAttempts: isChinese ? '尝试次数过多，请稍后再试' : 'Too many attempts, please try again later'
        };

        // 获取CSRF token
        async function getCSRFToken() {
            try {
                const response = await fetch('/api/auth?action=csrf', {
                    method: 'GET',
                    credentials: 'include'
                });
                const data = await response.json();
                return data.csrfToken;
            } catch (error) {
                console.warn('Failed to get CSRF token:', error);
                return null;
            }
        }

        // 防抖函数
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = passwordInput.value.trim();
            if (!password) return;

            // 显示加载状态
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            loading.style.display = 'block';
            errorMessage.style.display = 'none';

            try {
                // 获取CSRF token
                const csrfToken = await getCSRFToken();
                
                const response = await fetch('/api/auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || ''
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        action: 'verify',
                        password: password,
                        csrfToken: csrfToken
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // 认证成功，刷新页面
                    window.location.reload();
                } else {
                    // 认证失败
                    errorMessage.textContent = data.message || errorMessages.invalidPassword;
                    errorMessage.style.display = 'block';
                    passwordInput.value = '';
                    passwordInput.focus();
                    
                    // 如果是429错误，显示重试时间
                    if (response.status === 429) {
                        errorMessage.textContent = errorMessages.tooManyAttempts;
                    }
                }
            } catch (error) {
                console.error('认证请求失败:', error);
                errorMessage.textContent = errorMessages.network;
                errorMessage.style.display = 'block';
            } finally {
                // 恢复按钮状态
                submitBtn.disabled = false;
                btnText.style.display = 'inline';
                loading.style.display = 'none';
            }
        });

        // 密码输入框获得焦点
        passwordInput.focus();

        // 清除错误信息当用户开始输入
        passwordInput.addEventListener('input', () => {
            errorMessage.style.display = 'none';
        });
        
        // 按ESC键聚焦到密码输入框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                passwordInput.focus();
                errorMessage.style.display = 'none';
            }
        });

        // 页面加载时获取CSRF token
        window.addEventListener('load', () => {
            getCSRFToken();
        });
    </script>
</body>
</html>`;
} 