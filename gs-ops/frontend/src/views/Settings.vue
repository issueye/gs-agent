<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-xl font-semibold">系统设置</h2>
      <p class="text-sm text-slate-500">当前开发阶段的项目级默认配置。</p>
    </div>

    <section class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <h3 class="font-semibold">API 地址</h3>
        <p class="mt-2 text-sm text-slate-500">前端在本地开发时通过 Vite 代理访问后端接口。</p>
        <code class="mt-3 block rounded-md bg-slate-100 p-3 text-sm">/api → http://127.0.0.1:7310</code>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <h3 class="font-semibold">认证</h3>
        <p class="mt-2 text-sm text-slate-500">后端认证中间件已接入，当前处于开发模式。</p>
        <div class="mt-3 inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-warning">开发模式</div>
      </div>
    </section>
  </div>
</template>
