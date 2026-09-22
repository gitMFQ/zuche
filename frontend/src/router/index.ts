import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'
import { authApi } from '../api'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '总览' }
      },
      {
        path: 'vehicles',
        name: 'Vehicles',
        component: () => import('../views/Vehicles.vue'),
        meta: { title: '车辆管理' }
      },
      {
        path: 'finance',
        name: 'Finance',
        component: () => import('../views/Finance.vue'),
        // 读权限对所有登录用户开放，写权限由后端 adminOnly 兜底（与车辆/订单同策略）
        meta: { title: '财务' }
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('../views/Customers.vue'),
        meta: { title: '客户管理' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('../views/Orders.vue'),
        meta: { title: '订单管理' }
      },
      {
        path: 'orders/import',
        name: 'OrderImport',
        component: () => import('../views/OrderImport.vue'),
        meta: { title: '批量导入订单' }
      },
      {
        path: 'orders/:id',
        name: 'OrderDetail',
        component: () => import('../views/OrderDetail.vue'),
        meta: { title: '订单详情' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '设置', roles: ['admin'] }
      }
    ]
  },
  {
    // 兜底路由：不写的话未知路径会渲染空白页（SPA 回落到 index.html 但没有匹配的组件）
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to) => {
  document.title = `${to.meta.title || '租车管理系统'} - 租车管理系统`

  const userStore = useUserStore()
  const token = userStore.token || localStorage.getItem('token')

  if (to.path !== '/login' && !token) {
    return '/login'
  }
  if (to.path === '/login') {
    return token ? '/dashboard' : true
  }

  // 刷新页面后 store 里的 user 会丢（原先只在登录时 setUser），
  // 不补拉一次的话 isAdmin() 恒为 false —— 管理员菜单会消失，角色校验也会失效
  if (!userStore.user) {
    try {
      const res: any = await authApi.getCurrentUser()
      if (res.success) {
        userStore.setUser(res.data)
        userStore.mustChangePassword = Boolean(res.data.must_change_password)
      }
    } catch (error: any) {
      // 401 由响应拦截器统一处理（清 token 并跳登录页）；
      // 网络异常不要误判成未登录，否则会把人直接踢出系统
      if (error?.response?.status === 401) {
        return '/login'
      }
      return true
    }
  }

  const roles = to.meta.roles as string[] | undefined
  if (roles && roles.length > 0 && !roles.includes(userStore.user?.role ?? '')) {
    ElMessage.error('没有访问该页面的权限')
    return '/dashboard'
  }

  return true
})

export default router
