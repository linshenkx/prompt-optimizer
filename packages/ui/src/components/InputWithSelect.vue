<template>
  <div ref="componentRef" class="relative">
    <NInput
      ref="inputRef"
      :value="modelValue"
      @update:value="handleInput"
      :type="type"
      :placeholder="placeholder"
      :loading="isLoading"
      clearable
    >
      <template #suffix>
        <NButton
          quaternary
          circle
          size="small"
          @click="toggleDropdown"
          :loading="isLoading"
        >
          <template #icon>
            <UiChevronDown />
          </template>
        </NButton>
      </template>
    </NInput>
    
    <!-- 提示文本 -->
    <transition name="fade">
      <div v-if="!isOpen && !isLoading && showHint" 
          class="select-hint absolute right-12 top-0 bottom-0 min-w-[120px] flex items-center pointer-events-none">
        {{ hintText }}
      </div>
    </transition>
    
    <!-- Dropdown Menu -->
    <NCard
      v-if="isOpen"
      size="small"
      class="absolute z-10 mt-1 w-full shadow-lg max-h-60 overflow-auto"
      :bordered="true"
    >
      <NEmpty v-if="isLoading" size="small" :description="loadingText" />
      <NEmpty v-else-if="filteredOptions.length === 0" size="small" :description="noOptionsText" />
      <NSpace v-else vertical size="small">
        <NButton
          v-for="option in filteredOptions"
          :key="option.value"
          text
          block
          size="small"
          @click="selectOption(option)"
          class="select-option"
          :class="{
            'select-option--selected': modelValue === option.value
          }"
        >
          {{ option.label }}
        </NButton>
      </NSpace>
    </NCard>
  </div>
</template>

<script setup>
import { ChevronDown as UiChevronDown } from '@lucide/vue'
import { ref, onMounted, onUnmounted, computed } from 'vue'

import { NInput, NButton, NCard, NEmpty, NSpace } from 'naive-ui';

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    default: () => []
  },
  type: {
    type: String,
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: ''
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  loadingText: {
    type: String,
    default: 'Loading...'
  },
  noOptionsText: {
    type: String,
    default: 'No options available'
  },
  fetchOptions: {
    type: Function,
    default: null
  },
  showHint: {
    type: Boolean,
    default: true
  },
  hintText: {
    type: String,
    default: 'Click to fetch options'
  }
});

const emit = defineEmits(['update:modelValue', 'select', 'fetchOptions']);

const isOpen = ref(false);
const inputRef = ref(null);
const searchText = ref('');

// 根据输入内容筛选选项
const filteredOptions = computed(() => {
  if (!searchText.value) return props.options;
  return props.options.filter(option => 
    option.label.toLowerCase().includes(searchText.value.toLowerCase()) ||
    option.value.toLowerCase().includes(searchText.value.toLowerCase())
  );
});

// 处理输入事件
const handleInput = (value) => {
  emit('update:modelValue', value);
  searchText.value = value;
};

// Toggle dropdown visibility
const toggleDropdown = async () => {
  isOpen.value = !isOpen.value;
  
  // 如果打开下拉菜单，聚焦到输入框
  if (isOpen.value) {
    emit('fetchOptions');
    // 等待DOM更新后聚焦
    setTimeout(() => {
      if (inputRef.value && inputRef.value.focus) {
        inputRef.value.focus();
      }
    }, 10);
  }
};

// Handle option selection
const selectOption = (option) => {
  emit('update:modelValue', option.value);
  emit('select', option);
  isOpen.value = false;
  searchText.value = '';
};

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  // 只有在下拉菜单打开且点击的是组件外部时才关闭下拉菜单
  if (isOpen.value && componentRef.value && !componentRef.value.contains(event.target)) {
    isOpen.value = false;
    searchText.value = '';
  }
};

// 组件引用
const componentRef = ref(null);

// Add and remove event listener
onMounted(() => {
  if (typeof document !== 'undefined') {
    // 使用捕获阶段以确保事件能够被正确捕获
    document.addEventListener('mousedown', handleClickOutside, true);
  }
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('mousedown', handleClickOutside, true);
  }
});
</script>

<style scoped>
/* 提示文本的淡入淡出效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Pure Naive UI implementation - dropdown and hover styles handled by Naive UI */
.select-hint {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.select-option {
  justify-content: flex-start;
  color: var(--n-text-color-2);
}

.select-option:hover,
.select-option--selected {
  background: var(--n-hover-color);
  color: var(--n-text-color);
}

.select-option--selected {
  box-shadow: inset 2px 0 0 var(--n-primary-color);
}
</style>
