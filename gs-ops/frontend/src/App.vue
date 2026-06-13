<template>
  <div class="min-h-screen bg-field text-ink">
    <AppSidebar />
    <div class="min-h-screen lg:pl-64">
      <AppHeader />
      <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <RouterView />
      </main>
      <AppFooter />
    </div>
  </div>
</template>

<script setup>
import AppFooter from './components/layout/Footer.vue'
import AppHeader from './components/layout/Header.vue'
import AppSidebar from './components/layout/Sidebar.vue'
</script>

