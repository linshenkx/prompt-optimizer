<template>
  <div class="relative" ref="menuContainer">
    <!-- 主题切换按钮 -->
    <button 
      @click.stop="toggleMenu" 
      class="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      :title="currentThemeText"
      aria-label="切换主题"
    >
      <!-- 亮色主题图标 -->
      <svg v-if="currentTheme === 'light'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
      </svg>
      
      <!-- 暗色主题图标 -->
      <svg v-else-if="currentTheme === 'dark'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-100" viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>
      
      <!-- 紫色主题图标 -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-300" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- 主题下拉菜单 -->
    <div 
      v-if="showMenu" 
      class="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50"
      @click.stop
    >
      <div class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
        选择主题
      </div>
      
      <button 
        @click="setTheme('light')" 
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
        :class="currentTheme === 'light' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
        </svg>
        <span>亮色模式</span>
      </button>
      
      <button 
        @click="setTheme('dark')" 
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
        :class="currentTheme === 'dark' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
        <span>暗色模式</span>
      </button>
      
      <button 
        @click="setTheme('purple')" 
        class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
        :class="currentTheme === 'purple' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd" />
        </svg>
        <span>紫色主题</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const menuContainer = ref(null);
const showMenu = ref(false);
const currentTheme = ref('dark'); // 默认使用暗色主题

// 主题描述文本
const currentThemeText = computed(() => {
  switch (currentTheme.value) {
    case 'light': return '亮色模式';
    case 'dark': return '暗色模式';
    case 'purple': return '紫色主题';
    default: return '切换主题';
  }
});

// 切换菜单显示
const toggleMenu = (event) => {
  event.stopPropagation(); // 阻止事件冒泡
  showMenu.value = !showMenu.value;
};

// 关闭菜单
const handleClickOutside = (event) => {
  if (menuContainer.value && !menuContainer.value.contains(event.target)) {
    showMenu.value = false;
  }
};

// 设置主题
const setTheme = (theme) => {
  const htmlEl = document.documentElement;
  
  // 移除所有主题类
  htmlEl.classList.remove('dark', 'theme-purple');
  
  // 根据选择设置主题
  if (theme === 'dark' || theme === 'purple') {
    htmlEl.classList.add('dark');
    
    if (theme === 'purple') {
      htmlEl.classList.add('theme-purple');
    }
  }
  
  // 保存主题偏好
  localStorage.setItem('theme', theme);
  currentTheme.value = theme;
  
  // 关闭菜单
  showMenu.value = false;
};

// 初始化主题
onMounted(() => {
  // 检查本地存储的主题偏好
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme) {
    // 使用保存的主题
    setTheme(savedTheme);
  } else {
    // 默认使用暗色主题
    setTheme('dark');
  }
  
  // 添加点击外部关闭菜单的事件监听
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  // 移除事件监听器
  document.removeEventListener('click', handleClickOutside);
});
</script>