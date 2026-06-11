# 桌面端 UI/UED 设计系统规范

## 概述

本项目采用统一的设计系统，避免样式逃逸，确保视觉一致性。

## 架构

```
src/assets/
├── design-tokens.css    # 设计令牌 (唯一真实来源)
├── qq-ued.css          # QQ风格主题类
└── tailwind.css        # Tailwind 入口
```

## 设计令牌

**所有颜色、间距、阴影值必须使用 CSS 变量。**

### 颜色

```css
/* 文本 */
var(--color-text-primary)     /* #222222 */
var(--color-text-secondary)   /* #4b5563 */
var(--color-text-tertiary)    /* #6b7280 */

/* 主题色 */
var(--color-accent)           /* #0088ff */
var(--color-accent-strong)    /* #006ed0 */

/* 状态 */
var(--color-success)          /* #047857 */
var(--color-warning)          /* #8a4b05 */
var(--color-danger)           /* #c92a2a */

/* 状态背景 */
var(--status-success-bg)      /* rgba(16, 185, 129, 0.14) */
var(--status-warning-bg)      /* rgba(217, 119, 6, 0.14) */
var(--status-error-bg)        /* rgba(239, 68, 68, 0.14) */
```

### 间距

```css
var(--space-xs)   /* 4px */
var(--space-sm)   /* 8px */
var(--space-md)   /* 16px */
var(--space-lg)   /* 24px */
var(--space-xl)   /* 32px */
```

### 圆角

```css
var(--radius-sm)  /* 6px */
var(--radius-md)  /* 10px */
var(--radius-lg)  /* 14px */
```

## 使用规范

### ✅ 正确

```vue
<!-- 使用 CSS 变量 -->
<div class="bg-[var(--status-warning-bg)] text-[var(--color-warning)]">
  
<!-- 使用预定义 Tailwind 类 -->
<div class="text-accent bg-success">

<!-- 使用 QQ UED 工具类 -->
<div class="qq-panel">
```

### ❌ 错误

```vue
<!-- 硬编码十六进制 -->
<div class="bg-[#8a4b05]">

<!-- 硬编码 RGBA -->
<div class="bg-[rgba(217,119,6,0.14)]">

<!-- 内联样式 -->
<div style="color: #0088ff">
```

## 组件库

位于 `src/components/ued/`：

- `QqButton.vue` - 按钮
- `QqInput.vue` - 输入框
- `QqTag.vue` - 标签
- `QqFormField.vue` - 表单字段
- `QqCheckboxGroup.vue` - 复选框组

**所有新 UI 组件必须使用设计令牌。**

## 检查清单

开发新功能前：

- [ ] 颜色值是否使用 CSS 变量？
- [ ] 间距是否使用标准 scale？
- [ ] 是否复用了现有组件？
- [ ] 是否避免内联样式？

## 迁移指南

替换硬编码颜色：

```diff
- class="text-[#8a4b05]"
+ class="text-[var(--color-warning)]"

- class="bg-[rgba(217,119,6,0.14)]"
+ class="bg-[var(--status-warning-bg)]"
```
