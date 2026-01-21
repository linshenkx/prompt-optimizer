<!-- Toast组件 - 基于Naive UI NMessageProvider -->
<template>
    <!-- Naive UI的消息提供者组件 -->
    <NMessageProvider
        placement="top-right"
        container-style="position: fixed; top: 20px; right: 20px;"
    >
        <NDialogProvider>
            <MessageApiInitializer />
            <slot />
        </NDialogProvider>
    </NMessageProvider>
</template>

<script setup lang="ts">
import { onMounted, defineComponent, h } from "vue";
import { NMessageProvider, NDialogProvider, useMessage } from "naive-ui";

import { setGlobalMessageApi } from '../composables/ui/useToast';

// 内部组件用于在正确的上下文中初始化消息API
const MessageApiInitializer = defineComponent({
    name: "MessageApiInitializer",
    setup() {
        onMounted(() => {
            try {
                const messageApi = useMessage();
                setGlobalMessageApi(messageApi);
                console.log("[Toast] Message API initialized successfully");
            } catch (error) {
                console.warn(
                    "[Toast] Message API initialization failed (this is normal during SSR or when provider is not ready):",
                    error,
                );
            }
        });
        return () => h("div", { style: { display: "none" } });
    },
});
</script>
