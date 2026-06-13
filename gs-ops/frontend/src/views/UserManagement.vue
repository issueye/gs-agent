<template>
  <div class="p-6">
    <div class="mb-6 flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-800">用户管理</h1>
      <button
        v-if="canManageUsers"
        @click="openCreateModal"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        + 创建用户
      </button>
    </div>

    <!-- 用户列表 -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              用户名
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              显示名称
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              角色
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              邮箱
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              最后登录
            </th>
            <th v-if="canManageUsers" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="user in users" :key="user.id">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">{{ user.username }}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">{{ user.displayName }}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                :class="getRoleBadgeClass(user.role)"
              >
                {{ getRoleLabel(user.role) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-500">{{ user.email || '-' }}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                :class="user.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
              >
                {{ user.enabled ? '启用' : '禁用' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(user.lastLoginAt) }}
            </td>
            <td v-if="canManageUsers" class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button
                @click="openEditModal(user)"
                class="text-blue-600 hover:text-blue-900 mr-3"
              >
                编辑
              </button>
              <button
                @click="openResetPasswordModal(user)"
                class="text-orange-600 hover:text-orange-900 mr-3"
              >
                重置密码
              </button>
              <button
                v-if="user.id !== currentUser?.id"
                @click="confirmDelete(user)"
                class="text-red-600 hover:text-red-900"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading" class="text-center py-8">
        <span class="text-gray-500">加载中...</span>
      </div>

      <div v-if="!loading && users.length === 0" class="text-center py-8">
        <span class="text-gray-500">暂无用户</span>
      </div>
    </div>

    <!-- 创建/编辑用户模态框 -->
    <Modal v-if="showUserModal" @close="closeUserModal">
      <template #title>
        {{ editingUser ? '编辑用户' : '创建用户' }}
      </template>
      <template #content>
        <form @submit.prevent="handleSaveUser">
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2">
              用户名 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="userForm.username"
              type="text"
              :disabled="!!editingUser"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
              required
            />
          </div>

          <div v-if="!editingUser" class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2">
              密码 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="userForm.password"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            />
            <p class="text-xs text-gray-500 mt-1">密码长度至少8位，包含大小写字母和数字</p>
          </div>

          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2">
              显示名称
            </label>
            <input
              v-model="userForm.displayName"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2">
              角色 <span class="text-red-500">*</span>
            </label>
            <select
              v-model="userForm.role"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            >
              <option value="admin">管理员</option>
              <option value="operator">操作员</option>
              <option value="viewer">查看者</option>
            </select>
          </div>

          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2">
              邮箱
            </label>
            <input
              v-model="userForm.email"
              type="email"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div v-if="editingUser" class="mb-4">
            <label class="flex items-center">
              <input
                v-model="userForm.enabled"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-gray-700 text-sm font-bold">启用账户</span>
            </label>
          </div>

          <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {{ errorMessage }}
          </div>

          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="closeUserModal"
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </template>
    </Modal>

    <!-- 重置密码模态框 -->
    <Modal v-if="showResetPasswordModal" @close="closeResetPasswordModal">
      <template #title>重置密码</template>
      <template #content>
        <form @submit.prevent="handleResetPassword">
          <div class="mb-4">
            <p class="text-gray-700 mb-4">
              重置用户 <strong>{{ resetPasswordUser?.username }}</strong> 的密码
            </p>
            <label class="block text-gray-700 text-sm font-bold mb-2">
              新密码 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="newPassword"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              required
            />
            <p class="text-xs text-gray-500 mt-1">密码长度至少8位，包含大小写字母和数字</p>
          </div>

          <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {{ errorMessage }}
          </div>

          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="closeResetPasswordModal"
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400"
            >
              {{ saving ? '重置中...' : '确认重置' }}
            </button>
          </div>
        </form>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import * as userApi from '../api/user'
import Modal from '../components/common/Modal.vue'

const userStore = useUserStore()

const users = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const showUserModal = ref(false)
const showResetPasswordModal = ref(false)
const editingUser = ref(null)
const resetPasswordUser = ref(null)
const newPassword = ref('')

const userForm = ref({
  username: '',
  password: '',
  displayName: '',
  role: 'viewer',
  email: '',
  enabled: true,
})

const currentUser = computed(() => userStore.currentUser)
const canManageUsers = computed(() => userStore.hasPermission('users:manage'))

// 获取用户列表
async function fetchUsers() {
  loading.value = true
  try {
    const response = await userApi.getUserList()
    if (response.success) {
      users.value = response.data
    }
  } catch (error) {
    console.error('Fetch users error:', error)
  } finally {
    loading.value = false
  }
}

// 打开创建模态框
function openCreateModal() {
  editingUser.value = null
  userForm.value = {
    username: '',
    password: '',
    displayName: '',
    role: 'viewer',
    email: '',
    enabled: true,
  }
  errorMessage.value = ''
  showUserModal.value = true
}

// 打开编辑模态框
function openEditModal(user) {
  editingUser.value = user
  userForm.value = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    enabled: user.enabled,
  }
  errorMessage.value = ''
  showUserModal.value = true
}

// 关闭用户模态框
function closeUserModal() {
  showUserModal.value = false
  editingUser.value = null
}

// 保存用户
async function handleSaveUser() {
  saving.value = true
  errorMessage.value = ''

  try {
    let response
    if (editingUser.value) {
      response = await userApi.updateUser(editingUser.value.id, userForm.value)
    } else {
      response = await userApi.createUser(userForm.value)
    }

    if (response.success) {
      closeUserModal()
      await fetchUsers()
    }
  } catch (error) {
    errorMessage.value = error.message || '保存失败'
  } finally {
    saving.value = false
  }
}

// 打开重置密码模态框
function openResetPasswordModal(user) {
  resetPasswordUser.value = user
  newPassword.value = ''
  errorMessage.value = ''
  showResetPasswordModal.value = true
}

// 关闭重置密码模态框
function closeResetPasswordModal() {
  showResetPasswordModal.value = false
  resetPasswordUser.value = null
}

// 重置密码
async function handleResetPassword() {
  saving.value = true
  errorMessage.value = ''

  try {
    const response = await userApi.resetUserPassword(
      resetPasswordUser.value.id,
      newPassword.value
    )

    if (response.success) {
      closeResetPasswordModal()
      alert('密码重置成功')
    }
  } catch (error) {
    errorMessage.value = error.message || '重置失败'
  } finally {
    saving.value = false
  }
}

// 确认删除
function confirmDelete(user) {
  if (confirm(`确定要删除用户 ${user.username} 吗？此操作无法撤销。`)) {
    deleteUser(user)
  }
}

// 删除用户
async function deleteUser(user) {
  try {
    const response = await userApi.deleteUser(user.id)
    if (response.success) {
      await fetchUsers()
    }
  } catch (error) {
    alert(error.message || '删除失败')
  }
}

// 格式化角色标签
function getRoleLabel(role) {
  const labels = {
    admin: '管理员',
    operator: '操作员',
    viewer: '查看者',
  }
  return labels[role] || role
}

// 角色徽章样式
function getRoleBadgeClass(role) {
  const classes = {
    admin: 'bg-purple-100 text-purple-800',
    operator: 'bg-blue-100 text-blue-800',
    viewer: 'bg-gray-100 text-gray-800',
  }
  return classes[role] || 'bg-gray-100 text-gray-800'
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  fetchUsers()
})
</script>
