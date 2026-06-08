<template>
  <div class="flex flex-1 items-start justify-center px-6 pt-[11vh]">
    <div class="w-full max-w-3xl">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--qq-border)] bg-white text-2xl font-semibold text-[color:var(--qq-accent)] shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
        IC
      </div>
      <h2 class="mt-7 text-center text-5xl font-semibold leading-tight text-[color:var(--qq-text-primary)]">
        让 Agent 接手真实工作
      </h2>
      <p class="mx-auto mt-4 max-w-2xl text-center text-sm leading-7 text-[color:var(--qq-text-secondary)]">
        选择网关中的 Agent，发起任务，桌面端会创建会话并通过 WebSocket 持续接收执行过程和回复。
      </p>
      <div class="mt-10 grid gap-3 sm:grid-cols-2">
        <div class="rounded-2xl border border-[color:var(--qq-border)] bg-white/76 p-4 shadow-sm">
          <p class="text-sm font-semibold text-[color:var(--qq-text-primary)]">代码任务</p>
          <p class="mt-2 text-sm leading-6 text-[color:var(--qq-text-secondary)]">描述要修改、审查或验证的项目内容。</p>
        </div>
        <div class="rounded-2xl border border-[color:var(--qq-border)] bg-white/76 p-4 shadow-sm">
          <p class="text-sm font-semibold text-[color:var(--qq-text-primary)]">自动化任务</p>
          <p class="mt-2 text-sm leading-6 text-[color:var(--qq-text-secondary)]">让网关 Agent 跑长任务、工具调用或定时执行链路。</p>
        </div>
      </div>
    </div>
  </div>
</template>
