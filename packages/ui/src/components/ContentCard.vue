<template>
  <div class="flex flex-col h-[calc(50vh-2rem)] lg:h-full">
    <div class="theme-card flex flex-col h-full">
      <div class="p-3 sm:p-4 space-y-3 sm:space-y-4 flex flex-col flex-1">
        <slot></slot>
      </div>
    </div>
  </div>
</template>