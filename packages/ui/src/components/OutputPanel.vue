<!-- 输出面板组件 -->
<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold theme-title">测试结果</h3>
      <button
        v-if="result"
        @click="copySelectedText"
        class="px-3 py-1.5 theme-button-secondary flex items-center space-x-2"
      >
        <span>复制</span>
      </button>
    </div>


    <div class="flex-1 min-h-0 relative">
      <div class="h-full relative">
        <div
          ref="resultContainer"
          class="absolute inset-0 w-full h-full p-4 rounded-xl theme-input whitespace-pre-wrap overflow-auto"
        >
          <span v-if="!contentTokens.length" class="theme-text-secondary">测试结果将显示在这里...</span>
          <span v-else v-text="displayContent" class="theme-text"></span>
        </div>
      </div>

      <div
        v-if="error"
        class="absolute top-2 right-2 theme-error px-3 py-1.5 rounded-lg flex items-center space-x-2"
      >
        <span>❌</span>
        <span>{{ error }}</span>
      </div>

      <div
        v-if="loading && !isStreaming"
        class="absolute top-2 right-2 theme-loading px-3 py-1.5 rounded-lg flex items-center space-x-2"
      >
        <span class="animate-spin">⏳</span>
        <span>处理中...</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineEmits, defineProps, watch, nextTick, onMounted, computed } from 'vue'
import { useToast } from '../composables/useToast'

const toast = useToast()
const contentTokens = ref([])
const isStreaming = ref(false)
const resultContainer = ref(null)

// 计算完整内容
const displayContent = computed(() => {
  console.log('displayContent 更新，当前tokens数:', contentTokens.value.length);
  return contentTokens.value.join('');
})

// 监听组件挂载
onMounted(async () => {
  await nextTick();
  console.log('组件已挂载，容器存在:', !!resultContainer.value);
});

// 监听数组变化
watch(contentTokens, (newVal) => {
  console.log('contentTokens 发生变化，当前长度:', newVal.length);
  // 强制更新视图
  nextTick(() => {
    if (resultContainer.value) {
      resultContainer.value.scrollTop = resultContainer.value.scrollHeight;
    }
  });
}, { deep: true });

const props = defineProps({
  loading: Boolean,
  error: String,
  result: String
})

// 定义事件
const emit = defineEmits(['update:result'])

// 监听 result 变化
watch(() => props.result, (newVal) => {
  if (!isStreaming.value && newVal) {
    contentTokens.value = [newVal]
  }
})

// 更新文本
const updateContent = (text) => {
  console.log('准备更新内容:', text.substring(0, 20) + '...');
  contentTokens.value = [...contentTokens.value, text];
  console.log('内容已更新，当前tokens数:', contentTokens.value.length);
};

// 处理流式响应
const handleStream = () => {
  console.log('开始处理流式响应，容器存在:', !!resultContainer.value);
  isStreaming.value = true;
  contentTokens.value = [];
  
  return {
    onToken: (token) => {
      console.log('收到token:', { 
        tokenLength: token.length,
        token: token.substring(0, 50) + '...',
        containerExists: !!resultContainer.value,
        currentTokensCount: contentTokens.value.length
      });
      
      // 直接更新内容
      updateContent(token);
    },
    onComplete: () => {
      console.log('流式响应完成，总tokens数:', contentTokens.value.length);
      isStreaming.value = false;
      emit('update:result', displayContent.value);
    },
    onError: (error) => {
      console.error('流式响应出错:', error);
      isStreaming.value = false;
      toast.error(error.message);
    }
  };
};

defineExpose({ handleStream })

// 复制选中的文本，如果没有选中则复制全部
const copySelectedText = async () => {
  if (!resultContainer.value) return
  
  const selectedText = window.getSelection().toString()
  const textToCopy = selectedText || displayContent.value
  
  try {
    await navigator.clipboard.writeText(textToCopy)
    toast.success('复制成功')
  } catch (err) {
    toast.error('复制失败')
  }
}
</script>

<style scoped>
.whitespace-pre-wrap {
  white-space: pre-wrap;
}

.token-item {
  display: inline;
}

/* 隐藏滚动条但保持可滚动 */
.overflow-auto {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.overflow-auto::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}
</style>