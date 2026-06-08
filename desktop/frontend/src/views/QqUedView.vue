<script setup>
import { computed, reactive, ref } from 'vue'
import { Bell, MessageCircleMore, Search, Sparkles } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqCheckboxGroup from '@/components/ued/QqCheckboxGroup.vue'
import QqFormField from '@/components/ued/QqFormField.vue'
import QqFormSection from '@/components/ued/QqFormSection.vue'
import QqInput from '@/components/ued/QqInput.vue'
import QqModal from '@/components/ued/QqModal.vue'
import QqPagination from '@/components/ued/QqPagination.vue'
import QqRadioGroup from '@/components/ued/QqRadioGroup.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import QqSwitch from '@/components/ued/QqSwitch.vue'
import QqTable from '@/components/ued/QqTable.vue'
import QqTabs from '@/components/ued/QqTabs.vue'
import QqTag from '@/components/ued/QqTag.vue'
import QqTextarea from '@/components/ued/QqTextarea.vue'

const colorTokens = [
  { name: 'QQ Mint', value: '#36dcc8', role: '主操作、焦点、选中态' },
  { name: 'QQ Green', value: '#13c08e', role: '渐变落点、强调按钮' },
  { name: 'QQ Pink', value: '#f38ad5', role: '辅助标签、提醒态' },
  { name: 'Glass White', value: 'rgba(255,255,255,0.14)', role: '面板高光层' },
  { name: 'Text Soft', value: 'rgba(235,255,248,0.78)', role: '次级文本' },
  { name: 'Signal Yellow', value: '#ffd968', role: '必填、轻提示' },
]

const spacingRules = [
  '控件高度以 36 / 40 为主，适配桌面端高频操作和紧凑表单。',
  '输入、按钮、标签以 4px 圆角为主，面板控制在 6px / 8px，避免过度圆润。',
  '容器层级遵循「背景 > 玻璃面板 > 操作控件 > 状态标签」，边框始终轻于阴影。',
]

const cityOptions = [
  { label: '深圳南山', value: 'shenzhen' },
  { label: '上海徐汇', value: 'shanghai' },
  { label: '杭州滨江', value: 'hangzhou' },
]

const toneOptions = [
  { label: '标准沟通', value: 'standard', description: '适合日常消息与功能入口，信息密度均衡。' },
  { label: '工作优先', value: 'work', description: '降低装饰层存在感，突出信息扫描和批量操作。' },
  { label: '轻社交', value: 'social', description: '辅助色更明显，适合会话、群组与提醒类场景。' },
]

const moduleOptions = [
  { label: '消息流', value: 'message', description: '聊天列表、会话卡片、输入动作条。' },
  { label: '联系人', value: 'contact', description: '人物头像、备注、状态信息。' },
  { label: '群协作', value: 'group', description: '群公告、成员列表、群工具。' },
  { label: '通知中心', value: 'notice', description: '红点、提醒、轻量状态切换。' },
]

const form = reactive({
  appName: 'QQ 风格 UED 控件库',
  owner: 'UED Team',
  city: 'shenzhen',
  tone: 'work',
  modules: ['message', 'group'],
  introduction:
    '这一套组件服务于桌面端聊天、管理台和群协作页面。视觉上保持 QQ 的轻盈感，结构上保证表单与列表可以直接进入业务开发。',
  syncNotice: true,
  syncMute: false,
})

const currentTab = ref('overview')
const currentPage = ref(2)
const modalOpen = ref(false)

const tabs = [
  { label: '总览', value: 'overview' },
  { label: '消息组件', value: 'message' },
  { label: '管理组件', value: 'admin' },
]

const tableColumns = [
  { key: 'name', label: '组件' },
  { key: 'usage', label: '建议场景' },
  { key: 'status', label: '成熟度', type: 'status' },
  { key: 'coverage', label: '覆盖率', align: 'right' },
]

const tableRows = [
  { id: 1, name: 'QqButton', usage: '主次操作、工具栏命令', status: 'online', coverage: '4 variants' },
  { id: 2, name: 'QqInput', usage: '搜索、表单输入、过滤条件', status: 'online', coverage: 'prefix / invalid' },
  { id: 3, name: 'QqSelect', usage: '筛选器、状态切换、配置项', status: 'online', coverage: 'custom popup' },
  { id: 4, name: 'QqTextarea', usage: '简介、公告、批注输入', status: 'online', coverage: 'resizable' },
  { id: 5, name: 'QqSwitch', usage: '通知开关、状态切换', status: 'online', coverage: 'boolean state' },
  { id: 6, name: 'QqTabs', usage: '内容分栏、视图切换', status: 'online', coverage: '3 tabs' },
  { id: 7, name: 'QqModal', usage: '轻确认、编辑弹层', status: 'busy', coverage: 'teleport overlay' },
  { id: 8, name: 'QqTable', usage: '会话管理、成员表、规则列表', status: 'online', coverage: 'slot cell' },
  { id: 9, name: 'QqCheckboxGroup', usage: '批量勾选、模块开关', status: 'online', coverage: 'demo ready' },
]

const formSummary = computed(() => `${form.appName} · ${form.owner} · ${form.modules.length} modules`)
const currentTabLabel = computed(() => tabs.find((item) => item.value === currentTab.value)?.label || '总览')
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-4 py-4 md:px-5 md:py-5">
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <section class="qq-panel-strong qq-shell overflow-hidden rounded-[8px] px-5 py-5 md:px-6 md:py-6">
        <div class="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div class="max-w-3xl">
            <div class="flex flex-wrap items-center gap-3">
              <span class="qq-badge inline-flex rounded-[4px] px-2 py-0.5 text-xs">QQ UED</span>
              <span class="qq-badge inline-flex rounded-[4px] px-2 py-0.5 text-xs">Glass Messaging UI</span>
            </div>
            <h1 class="mt-5 text-3xl font-semibold md:text-5xl">QQ 风格设计规范与基础组件</h1>
            <p class="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--qq-text-secondary)] md:text-base">
              提炼 QQ 客户端的视觉语言，统一面板层次、控件状态和表单交互。目标不是复刻聊天窗口，而是沉淀一套可直接进入业务页面的 UED 基础层。
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div class="qq-punch rounded-[6px] px-3 py-3">
              <p class="text-xs text-[color:var(--qq-text-tertiary)]">主色方向</p>
              <p class="mt-2 text-lg font-semibold">青绿 + 玻璃白</p>
              <p class="mt-3 text-xs leading-6 text-[color:var(--qq-text-secondary)]">保持聊天产品的轻盈和科技感。</p>
            </div>
            <div class="qq-punch rounded-[6px] px-3 py-3">
              <p class="text-xs text-[color:var(--qq-text-tertiary)]">控件语言</p>
              <p class="mt-2 text-lg font-semibold">4px 小圆角</p>
              <p class="mt-3 text-xs leading-6 text-[color:var(--qq-text-secondary)]">输入、按钮、标签保持紧凑利落。</p>
            </div>
            <div class="qq-punch rounded-[6px] px-3 py-3">
              <p class="text-xs text-[color:var(--qq-text-tertiary)]">层次策略</p>
              <p class="mt-2 text-lg font-semibold">边框轻于阴影</p>
              <p class="mt-3 text-xs leading-6 text-[color:var(--qq-text-secondary)]">让内容浮起来，而不是被描死。</p>
            </div>
          </div>
        </div>
      </section>

      <div class="qq-grid xl:grid-cols-[1.2fr_0.8fr]">
        <QqFormSection
          eyebrow="Visual DNA"
          title="视觉规范"
          description="沿用 QQ 的高识别元素，但把风格压缩成可工程化的设计 token，方便组件和业务页面长期复用。"
        >
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div v-for="token in colorTokens" :key="token.name" class="qq-punch rounded-[6px] px-3 py-3">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-medium">{{ token.name }}</p>
                  <p class="mt-2 text-xs text-[color:var(--qq-text-tertiary)]">{{ token.role }}</p>
                </div>
                <span class="h-10 w-10 rounded-[4px] border border-white/15" :style="{ background: token.value }" />
              </div>
              <p class="mt-4 text-xs text-[color:var(--qq-text-secondary)]">{{ token.value }}</p>
            </div>
          </div>
        </QqFormSection>

        <QqFormSection
          eyebrow="Layout Rhythm"
          title="布局与状态"
          description="QQ 风格不是重装饰，而是把高频操作放在稳定位置。规范里优先保证视觉秩序和状态反馈。"
        >
          <div class="space-y-4">
            <div class="qq-punch rounded-[6px] px-3 py-3">
              <p class="text-sm font-medium">关键原则</p>
              <ul class="mt-3 space-y-2 text-sm leading-7 text-[color:var(--qq-text-secondary)]">
                <li>主按钮只保留一个高饱和焦点，避免页面同时出现多个抢眼操作。</li>
                <li>输入类控件默认半透明，获得焦点时再抬升亮度与边框强度。</li>
                <li>表格和列表优先用行高、留白、轻分割线组织，不依赖厚重卡片。</li>
              </ul>
            </div>
            <div class="qq-punch rounded-[6px] px-3 py-3">
              <p class="text-sm font-medium">尺寸节奏</p>
              <ul class="mt-3 space-y-2 text-sm leading-7 text-[color:var(--qq-text-secondary)]">
                <li v-for="rule in spacingRules" :key="rule">{{ rule }}</li>
              </ul>
            </div>
          </div>
        </QqFormSection>
      </div>

      <QqFormSection
        eyebrow="Components"
        title="控件封装"
        description="按钮、输入、下拉、单选、多选统一继承 QQ 主题 token。表单和表格保持一致的玻璃层、圆角和悬停逻辑。"
      >
        <div class="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <div class="qq-punch rounded-[6px] px-4 py-4">
            <p class="text-sm font-medium">按钮 Button</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <QqButton>发送消息</QqButton>
              <QqButton variant="secondary">加入群聊</QqButton>
              <QqButton variant="ghost">稍后处理</QqButton>
              <QqButton variant="danger">删除会话</QqButton>
            </div>
          </div>

          <div class="qq-punch rounded-[6px] px-4 py-4">
            <p class="text-sm font-medium">输入框 Input</p>
            <div class="mt-4 space-y-3">
              <QqInput v-model="form.appName" placeholder="请输入规范名称">
                <template #prefix>
                  <Search class="h-4 w-4" />
                </template>
              </QqInput>
              <QqInput model-value="invalid style" invalid />
            </div>
          </div>

          <div class="qq-punch rounded-[6px] px-4 py-4">
            <p class="text-sm font-medium">下拉框 Select</p>
            <div class="mt-4">
              <QqSelect v-model="form.city" :options="cityOptions" />
            </div>
          </div>
        </div>

        <div class="mt-4 grid gap-4 xl:grid-cols-2">
          <div class="qq-punch rounded-[6px] px-4 py-4">
            <p class="text-sm font-medium">单选 Radio</p>
            <div class="mt-4">
              <QqRadioGroup v-model="form.tone" :options="toneOptions" name="tone" />
            </div>
          </div>
          <div class="qq-punch rounded-[6px] px-4 py-4">
            <p class="text-sm font-medium">多选 Checkbox</p>
            <div class="mt-4">
              <QqCheckboxGroup v-model="form.modules" :options="moduleOptions" />
            </div>
          </div>
        </div>

        <div class="mt-4 grid gap-4 xl:grid-cols-3">
          <div class="qq-punch rounded-[6px] px-4 py-4 xl:col-span-2">
            <p class="text-sm font-medium">多行输入 Textarea</p>
            <div class="mt-4">
              <QqTextarea v-model="form.introduction" :rows="4" placeholder="填写业务简介或群公告" />
            </div>
          </div>

          <div class="qq-punch rounded-[6px] px-4 py-4">
            <p class="text-sm font-medium">标签 Tag</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <QqTag tone="accent">消息</QqTag>
              <QqTag tone="success">已发布</QqTag>
              <QqTag tone="pink">新提醒</QqTag>
              <QqTag tone="warning">需评审</QqTag>
            </div>
          </div>
        </div>
      </QqFormSection>

      <div class="qq-grid xl:grid-cols-[0.95fr_1.05fr]">
        <QqFormSection
          eyebrow="Form Demo"
          title="表单布局"
          description="用统一字段容器组织标题、说明、错误态，适合设置页、群管理和消息策略配置。"
        >
          <div class="grid gap-5 md:grid-cols-2">
            <QqFormField label="规范名称" helper="用于组件库、Figma 页面和前端包名统一。">
              <QqInput v-model="form.appName" placeholder="例如：QQ Business Kit" />
            </QqFormField>

            <QqFormField label="维护人" required helper="建议同步到设计负责人或前端 owner。">
              <QqInput v-model="form.owner" placeholder="请输入团队或负责人" />
            </QqFormField>

            <QqFormField label="默认城市" helper="决定示例数据和本地化占位文本。">
              <QqSelect v-model="form.city" :options="cityOptions" />
            </QqFormField>

            <QqFormField class="md:col-span-2" label="体验调性" helper="用于控制页面里主按钮与辅助色的出现频率。">
              <QqRadioGroup v-model="form.tone" :options="toneOptions" name="tone-form" />
            </QqFormField>
          </div>

          <div class="mt-4 rounded-[4px] border border-white/10 bg-[rgba(9,32,28,0.22)] px-3 py-3 text-sm text-[color:var(--qq-text-secondary)]">
            {{ formSummary }}
          </div>

          <div class="mt-5 grid gap-3">
            <QqSwitch
              v-model="form.syncNotice"
              label="同步桌面提醒"
              description="消息推送、红点和会话状态默认跟随本机通知。"
            />
            <QqSwitch
              v-model="form.syncMute"
              label="工作时段免打扰"
              description="在会话列表保留未读状态，但不主动弹出强提醒。"
            />
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <QqButton>
              <Sparkles class="h-4 w-4" />
              保存规范
            </QqButton>
            <QqButton variant="secondary">
              <Bell class="h-4 w-4" />
              发送评审
            </QqButton>
            <QqButton variant="ghost">
              <MessageCircleMore class="h-4 w-4" />
              预览讨论区
            </QqButton>
          </div>
        </QqFormSection>

        <QqFormSection
          eyebrow="Navigation + Table"
          title="导航、分页与信息密度"
          description="把常用的视图切换、列表状态和页码控件一起纳入规范，避免页面扩展后风格断裂。"
        >
          <div class="mb-5 flex flex-col gap-4">
            <QqTabs v-model="currentTab" :tabs="tabs" />
            <div class="flex flex-wrap items-center gap-2 text-sm text-[color:var(--qq-text-secondary)]">
              <span>当前视图：</span>
              <QqTag tone="accent">{{ currentTabLabel }}</QqTag>
              <QqTag v-if="form.syncNotice" tone="success">通知已同步</QqTag>
              <QqTag v-if="form.syncMute" tone="pink">免打扰中</QqTag>
            </div>
          </div>

          <QqTable :columns="tableColumns" :rows="tableRows">
            <template #cell-name="{ row, value }">
              <div>
                <p class="font-medium text-[color:var(--qq-text-primary)]">{{ value }}</p>
                <p class="mt-1 text-xs text-[color:var(--qq-text-tertiary)]">基础组件</p>
              </div>
            </template>
            <template #cell-coverage="{ value }">
              <span class="qq-badge inline-flex rounded-[4px] px-2 py-0.5 text-xs">{{ value }}</span>
            </template>
          </QqTable>

          <div class="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p class="text-sm text-[color:var(--qq-text-secondary)]">共 87 项组件记录，当前查看第 {{ currentPage }} 页。</p>
            <QqPagination v-model="currentPage" :page-size="10" :total="87" />
          </div>
        </QqFormSection>
      </div>

      <QqFormSection
        eyebrow="Feedback Layer"
        title="弹层与轻反馈"
        description="QQ 风格的弹层应该轻、快、明确。这里用玻璃弹层承接配置确认、二次操作和小范围编辑。"
      >
        <div class="flex flex-wrap items-center gap-3">
          <QqButton @click="modalOpen = true">打开示例弹层</QqButton>
          <QqButton variant="secondary">保存为模板</QqButton>
          <QqTag tone="default">Overlay</QqTag>
          <QqTag tone="pink">Glass Modal</QqTag>
        </div>
      </QqFormSection>
    </div>

    <QqModal
      v-model="modalOpen"
      title="发布组件规范"
      description="确认后会将当前 UED 规范同步到设计页、前端组件库和团队评审流。"
      @confirm="modalOpen = false"
    >
      <div class="grid gap-4">
        <div class="rounded-[4px] border border-white/10 bg-[rgba(9,32,28,0.22)] px-3 py-3">
          <p class="text-sm font-medium text-[color:var(--qq-text-primary)]">{{ form.appName }}</p>
          <p class="mt-2 text-sm leading-7 text-[color:var(--qq-text-secondary)]">{{ form.introduction }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <QqTag tone="accent">{{ currentTabLabel }}</QqTag>
          <QqTag tone="success">{{ form.owner }}</QqTag>
          <QqTag tone="warning">{{ form.modules.length }} modules</QqTag>
        </div>
      </div>
    </QqModal>
  </section>
</template>
