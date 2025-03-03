<template>
  <button
    @click="toggleTheme" 
    class="theme-text flex items-center gap-1 hover:scale-105 transform px-1.5 py-1"
  >
    <span class="text-base sm:text-lg">
      <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>
    </span>
    <span class="text-sm max-sm:hidden">{{ isDark ? '亮色主题' : '暗色主题' }}</span>
  </button>
</template>
  
  <script setup>
  import { ref, onMounted, watch } from 'vue';
  
  const isDark = ref(false);
  
  // 切换主题
  const toggleTheme = () => {
    isDark.value = !isDark.value;
    updateTheme();
  };
  
  // 更新主题
  const updateTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };
  
  // 初始化主题
  onMounted(() => {
    // 检查本地存储的主题偏好
    const savedTheme = localStorage.getItem('theme');
    
    // 如果用户之前选择了深色模式，或者系统偏好是深色模式且用户没有明确选择
    if (
      savedTheme === 'dark' || 
      (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      isDark.value = true;
    } else {
      isDark.value = false;
    }
    
    // 应用主题
    updateTheme();
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('theme')) {
        isDark.value = e.matches;
        updateTheme();
      }
    };
    
    // 添加事件监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) { // 兼容旧版浏览器
      mediaQuery.addListener(handleChange);
    }
  });
  </script>