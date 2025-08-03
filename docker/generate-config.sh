#!/bin/sh

# 生成前端运行时配置文件
generate_frontend_config() {
    CONFIG_FILE="/usr/share/nginx/html/config.js"
    
    cat > $CONFIG_FILE << EOF
window.runtime_config = {
  OPENAI_API_KEY: "${VITE_OPENAI_API_KEY:-}",
  GEMINI_API_KEY: "${VITE_GEMINI_API_KEY:-}",
  DEEPSEEK_API_KEY: "${VITE_DEEPSEEK_API_KEY:-}",
  SILICONFLOW_API_KEY: "${VITE_SILICONFLOW_API_KEY:-}",
  CUSTOM_API_KEY: "${VITE_CUSTOM_API_KEY:-}",
  CUSTOM_API_BASE_URL: "${VITE_CUSTOM_API_BASE_URL:-}",
  CUSTOM_API_MODEL: "${VITE_CUSTOM_API_MODEL:-}"
};
console.log("运行时配置已加载");
EOF

    echo "配置文件已生成: $CONFIG_FILE"
}

# 生成认证配置
generate_auth() {
    if [ -n "$ACCESS_PASSWORD" ]; then
        if [ "$ACCESS_PASSWORD" = "" ]; then
            echo "警告: 设置了空密码，不安全。不启用Basic认证"
            create_auth_config "off"
            return
        fi

        echo "启用Basic认证..."
        
        mkdir -p /etc/nginx/auth
        USERNAME=${ACCESS_USERNAME:-admin}
        
        printf '%s' "$ACCESS_PASSWORD" | htpasswd -i -c /etc/nginx/auth/.htpasswd "$USERNAME"
        chmod -R a+r /etc/nginx/auth
        
        create_auth_config "on" "$USERNAME"
    else
        echo "未设置ACCESS_PASSWORD环境变量，不启用Basic认证"
        create_auth_config "off"
    fi
}

# 创建认证配置文件
create_auth_config() {
    local auth_enabled=$1
    local username=$2
    
    if [ "$auth_enabled" = "on" ]; then
        cat > /etc/nginx/conf.d/auth.conf << EOF
# 此文件由启动脚本自动生成
auth_basic "请输入访问凭据 (Please enter your credentials)";
auth_basic_user_file /etc/nginx/auth/.htpasswd;
EOF
        echo "Basic认证已配置，用户名: $username"
        export AUTH_CONFIG="include /etc/nginx/conf.d/auth.conf;"
    else
        cat > /etc/nginx/conf.d/auth.conf << EOF
# Basic认证未启用
auth_basic off;
EOF
        export AUTH_CONFIG=""
    fi
}

# 生成nginx配置
generate_nginx_config() {
    echo "正在生成nginx配置..."
    envsubst '${NGINX_PORT},${AUTH_CONFIG}' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf
    echo "Nginx配置已生成"
}

# 主执行流程
echo "正在生成前端配置文件..."
generate_frontend_config

echo "正在配置认证..."
generate_auth

echo "正在生成nginx配置..."
generate_nginx_config

echo "配置生成完成"