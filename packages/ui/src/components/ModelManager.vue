<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    @click="$emit('close')"
  >
    <div class="theme-dialog-overlay"></div>
    <div
      class="theme-dialog-container max-w-3xl m-4"
      @click.stop
    >
      <div class="theme-dialog-body">
        <!-- 标题和关闭按钮 -->
        <div class="flex items-center justify-between">
          <h2 class="theme-dialog-title">模型设置</h2>
          <button
            @click="$emit('close')"
            class="text-gray-500 dark:text-white/60 hover:text-gray-700 dark:hover:text-white/90 transition-colors text-xl"
          >
            ×
          </button>
        </div>

        <!-- 已启用模型列表 -->
        <div class="space-y-3 mt-6">
          <h3 class="text-lg font-semibold theme-dialog-text">模型列表</h3>
          <div class="space-y-3">
            <div v-for="model in models" :key="model.key" 
                 :class="['theme-dialog-item',
                         model.enabled 
                           ? 'theme-dialog-item-active' 
                           : 'theme-dialog-item-inactive']">
              <div class="flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <h4 :class="['theme-dialog-text', model.enabled ? 'font-medium' : 'opacity-60']">
                      {{ model.name }}
                    </h4>
                    <span v-if="!model.enabled" class="theme-dialog-tag theme-dialog-tag-gray">
                      已禁用
                    </span>
                  </div>
                  <p :class="['theme-dialog-text-secondary text-sm', model.enabled ? '' : 'opacity-60']">
                    {{ model.model }}
                  </p>
                </div>
                <div class="flex items-center space-x-2">
                  <button @click="testConnection(model.key)"
                          class="theme-model-btn-test">
                    测试连接
                  </button>
                  <button @click="editModel(model.key)"
                          class="theme-model-btn-edit">
                    编辑
                  </button>
                  <button @click="model.enabled ? disableModel(model.key) : enableModel(model.key)"
                          :class="model.enabled ? 'theme-model-btn-disable' : 'theme-model-btn-enable'">
                    {{ model.enabled ? '禁用' : '启用' }}
                  </button>
                  <!-- 只对自定义模型显示删除按钮 -->
                  <button v-if="!isDefaultModel(model.key)" 
                          @click="handleDelete(model.key)"
                          class="theme-model-btn-delete">
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 使用 Teleport 将模态框传送到 body -->
        <Teleport to="body">
          <!-- 编辑模型弹窗 -->
          <div v-if="isEditing" 
               class="fixed inset-0 z-[60] flex items-center justify-center"
               @click="cancelEdit">
            <div class="theme-dialog-overlay"></div>
            
            <div class="theme-dialog-container max-w-2xl m-4 z-10"
                 @click.stop>
              <div class="theme-dialog-body">
                <div class="flex items-center justify-between">
                  <h3 class="theme-dialog-title">编辑模型</h3>
                  <button
                    @click="cancelEdit"
                    class="text-gray-500 dark:text-white/60 hover:text-gray-700 dark:hover:text-white/90 transition-colors text-xl"
                  >
                    ×
                  </button>
                </div>
                
                <form @submit.prevent="saveEdit" class="space-y-4 mt-6">
                  <div>
                    <label class="block text-sm font-medium theme-dialog-text mb-1.5">显示名称</label>
                    <input v-model="editingModel.name" type="text" required
                           class="theme-input w-full px-4 py-2 rounded-xl"
                           placeholder="例如: 自定义模型"/>
                  </div>
                  <div>
                    <label class="block text-sm font-medium theme-dialog-text mb-1.5">API 地址</label>
                    <input v-model="editingModel.baseURL" type="url" required
                           class="theme-input w-full px-4 py-2 rounded-xl"
                           placeholder="https://api.example.com/v1"/>
                  </div>
                  <div>
                    <label class="block text-sm font-medium theme-dialog-text mb-1.5">默认模型名称</label>
                    <input v-model="editingModel.defaultModel" type="text" required
                           class="theme-input w-full px-4 py-2 rounded-xl"
                           placeholder="例如: gpt-3.5-turbo"/>
                  </div>
                  <div>
                    <label class="block text-sm font-medium theme-dialog-text mb-1.5">API 密钥</label>
                    <input v-model="editingModel.apiKey" type="password"
                           class="theme-input w-full px-4 py-2 rounded-xl"
                           placeholder="输入新的 API 密钥（留空则保持不变）"/>
                  </div>
                  <div v-if="vercelProxyAvailable" class="flex items-center space-x-2">
                    <input 
                      :id="`vercel-proxy-${editingModel.key}`" 
                      v-model="editingModel.useVercelProxy" 
                      type="checkbox"
                      class="w-4 h-4 text-purple-600 bg-white/20 dark:bg-black/20 border-gray-300 dark:border-purple-600/50 rounded focus:ring-purple-500/50"
                    />
                    <label :for="`vercel-proxy-${editingModel.key}`" class="text-sm font-medium theme-dialog-text">
                      使用Vercel代理 (解决跨域问题，有一定风险，请谨慎使用)
                    </label>
                  </div>
                  <div class="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      @click="cancelEdit"
                      class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600/50 text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white/90 hover:border-gray-400 dark:hover:border-gray-500/60 transition-all"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      class="px-6 py-2 bg-purple-600 hover:bg-purple-500 dark:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-lg transition-colors"
                    >
                      保存修改
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <!-- 添加模型弹窗 -->
          <div v-if="showAddForm" 
               class="fixed inset-0 z-[60] flex items-center justify-center"
               @click="showAddForm = false">
            <div class="theme-dialog-overlay"></div>
            
            <div class="theme-dialog-container max-w-2xl m-4 z-10"
                 @click.stop>
              <div class="theme-dialog-body">
                <div class="flex items-center justify-between">
                  <h3 class="theme-dialog-title">添加自定义模型</h3>
                  <button
                    @click="showAddForm = false"
                    class="text-gray-500 dark:text-white/60 hover:text-gray-700 dark:hover:text-white/90 transition-colors text-xl"
                  >
                    ×
                  </button>
                </div>
                
                <form @submit.prevent="addCustomModel" class="space-y-4 mt-6">
                  <!-- 表单字段同上，使用相同的主题样式 -->
                  <!-- ... -->
                  <div class="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      @click="showAddForm = false"
                      class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600/50 text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white/90 hover:border-gray-400 dark:hover:border-gray-500/60 transition-all"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      class="px-6 py-2 bg-purple-600 hover:bg-purple-500 dark:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-lg transition-colors"
                    >
                      添加模型
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </Teleport>

        <!-- 添加模型按钮 -->
        <div class="mt-6 border-t border-gray-200 dark:border-purple-700/50 pt-6">
          <button
            @click="showAddForm = true"
            class="w-full px-4 py-2 text-white bg-purple-600 hover:bg-purple-500 dark:bg-purple-700 dark:hover:bg-purple-600 rounded-xl transition-colors flex items-center justify-center space-x-2"
          >
            <span>+</span>
            <span>添加自定义模型</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineEmits } from 'vue';
import { modelManager, createLLMService, checkVercelApiAvailability, resetVercelStatusCache } from '@prompt-optimizer/core';
import { useToast } from '../composables/useToast';

const toast = useToast();
const emit = defineEmits(['modelsUpdated', 'close', 'select']);

const models = ref([]);
const isEditing = ref(false);
const showAddForm = ref(false);
const editingModel = ref(null);
const newModel = ref({
  key: '',
  name: '',
  baseURL: '',
  defaultModel: '',
  apiKey: '',
  useVercelProxy: false
});
// 是否支持Vercel代理
const vercelProxyAvailable = ref(false);

// 检测Vercel代理是否可用
const checkVercelProxy = async () => {
  try {
    // 先重置缓存，确保每次都重新检测
    resetVercelStatusCache();
    // 使用core中的检测函数
    const available = await checkVercelApiAvailability();
    vercelProxyAvailable.value = available;
    console.log('Vercel代理检测结果:', vercelProxyAvailable.value);
  } catch (error) {
    console.log('Vercel代理不可用:', error);
    vercelProxyAvailable.value = false;
  }
};

// 加载所有模型
const loadModels = () => {
  try {
    // 强制刷新模型数据
    const allModels = modelManager.getAllModels();
    
    // 使用深拷贝确保响应式更新
    models.value = JSON.parse(JSON.stringify(allModels)).sort((a, b) => {
      // 启用的模型排在前面
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }
      // 默认模型排在前面
      if (isDefaultModel(a.key) !== isDefaultModel(b.key)) {
        return isDefaultModel(a.key) ? -1 : 1;
      }
      return 0;
    });
    
    console.log('处理后的模型列表:', models.value.map(m => ({
      key: m.key,
      name: m.name,
      enabled: m.enabled,
      hasApiKey: !!m.apiKey
    })));
    
    emit('modelsUpdated', models.value[0]?.key);
  } catch (error) {
    console.error('加载模型列表失败:', error);
    toast.error('加载模型列表失败');
  }
};

// 测试连接
const testConnection = async (key) => {
  try {
    const model = modelManager.getModel(key);
    if (!model) throw new Error('模型配置不存在');

    const llm = createLLMService(modelManager);
    await llm.testConnection(key);
    toast.success('连接测试成功');
  } catch (error) {
    console.error('连接测试失败:', error);
    toast.error(`连接测试失败: ${error.message}`);
  }
};

// 判断是否为默认模型
const isDefaultModel = (key) => {
  return ['openai', 'gemini', 'deepseek'].includes(key);
};

// 处理删除
const handleDelete = async (key) => {
  if (confirm(`确定要删除模型 ${key} 吗？此操作不可恢复。`)) {
    try {
      modelManager.deleteModel(key)
      loadModels()
      toast.success('模型已删除')
    } catch (error) {
      console.error('删除模型失败:', error)
      toast.error(`删除模型失败: ${error.message}`)
    }
  }
};

// 编辑模型
const editModel = (key) => {
  const model = modelManager.getModel(key);
  if (model) {
    editingModel.value = {
      key,
      name: model.name,
      baseURL: model.baseURL,
      defaultModel: model.defaultModel,
      apiKey: '',  // 不显示原有的 API 密钥
      useVercelProxy: model.useVercelProxy
    };
    isEditing.value = true;
  }
};

// 取消编辑
const cancelEdit = () => {
  isEditing.value = false;
  editingModel.value = null;
};

// 保存编辑
const saveEdit = async () => {
  console.log('开始保存编辑...');
  console.log('编辑的模型数据:', editingModel.value);
  
  try {
    const originalConfig = modelManager.getModel(editingModel.value.key)
    if (!originalConfig) {
      throw new Error('找不到原始配置')
    }
    console.log('原始配置:', originalConfig);

    const config = {
      name: editingModel.value.name,
      baseURL: editingModel.value.baseURL,
      models: [editingModel.value.defaultModel],
      defaultModel: editingModel.value.defaultModel,
      apiKey: editingModel.value.apiKey.trim() || originalConfig.apiKey,
      enabled: originalConfig.enabled,
      provider: originalConfig.provider,
      useVercelProxy: editingModel.value.useVercelProxy
    }
    console.log('新配置:', config);

    modelManager.updateModel(editingModel.value.key, config)
    
    loadModels()
    
    emit('modelsUpdated', editingModel.value.key)
    console.log('已触发 modelsUpdated 事件');
    
    isEditing.value = false
    editingModel.value = null
        
    toast.success('模型配置已更新')
  } catch (error) {
    console.error('更新模型失败:', error)
    toast.error(`更新模型失败: ${error.message}`)
  }
};

// 添加自定义模型
const addCustomModel = async () => {
  try {
    const config = {
      name: newModel.value.name,
      baseURL: newModel.value.baseURL,
      models: [newModel.value.defaultModel],
      defaultModel: newModel.value.defaultModel,
      apiKey: newModel.value.apiKey,
      enabled: true,
      provider: 'custom',
      useVercelProxy: newModel.value.useVercelProxy
    }

    modelManager.addModel(newModel.value.key, config)
    loadModels()
    showAddForm.value = false
    // 修改这里，传递新添加的模型的 key
    emit('modelsUpdated', newModel.value.key)
    newModel.value = {
      key: '',
      name: '',
      baseURL: '',
      defaultModel: '',
      apiKey: '',
      useVercelProxy: false
    }
    toast.success('模型添加成功')
  } catch (error) {
    console.error('添加模型失败:', error)
    toast.error(`添加模型失败: ${error.message}`)
  }
};

// 启用/禁用模型
const enableModel = async (key) => {
  try {
    const model = modelManager.getModel(key)
    if (!model) throw new Error('模型配置不存在')

    modelManager.enableModel(key)
    loadModels()
    // 修改这里，传递启用的模型的 key
    emit('modelsUpdated', key)
    toast.success('模型已启用')
  } catch (error) {
    console.error('启用模型失败:', error)
    toast.error(`启用模型失败: ${error.message}`)
  }
}

const disableModel = async (key) => {
  try {
    const model = modelManager.getModel(key)
    if (!model) throw new Error('模型配置不存在')

    modelManager.disableModel(key)
    loadModels()
    // 修改这里，传递禁用的模型的 key
    emit('modelsUpdated', key)
    toast.success('模型已禁用')
  } catch (error) {
    console.error('禁用模型失败:', error)
    toast.error(`禁用模型失败: ${error.message}`)
  }
}


// 初始化
onMounted(() => {
  loadModels();
  checkVercelProxy();
});
</script>

<style scoped>
/* 添加过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>