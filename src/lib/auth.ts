/**
 * 认证服务 - 前端
 */

const API_BASE = '/api/auth';

// 用户信息类型
export interface User {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatar?: string;
  role: string;
  emailVerified?: boolean;
  createdAt?: number;
  stats?: {
    totalStudyDays: number;
    totalStudyTime: number;
    totalQuestionsAnswered: number;
    totalCorrectAnswers: number;
    currentStreak: number;
    longestStreak: number;
  };
}

// 认证响应类型
interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
}

// 存储 key
const ACCESS_TOKEN_KEY = 'mindforge_access_token';
const REFRESH_TOKEN_KEY = 'mindforge_refresh_token';
const SESSION_ID_KEY = 'mindforge_session_id';
const USER_KEY = 'mindforge_user';

export const AUTH_LOGOUT_EVENT = 'auth:logout';

function emitAuthLogoutEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  }
}

function forceLogout() {
  clearAuth();
  emitAuthLogoutEvent();
}

// 获取存储的令牌
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_ID_KEY);
}

// 获取存储的用户信息
export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// 保存认证信息
function saveAuth(accessToken: string, refreshToken: string, user: User, sessionId?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (sessionId) {
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
}

// 清除认证信息
export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(USER_KEY);
}

// 检查是否已登录
export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

// 注册
export async function register(
  username: string,
  email: string,
  password: string,
  nickname?: string
): Promise<User> {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, nickname }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || '注册失败');
  }

  const { accessToken, refreshToken, user, sessionId } = data as AuthResponse;
  saveAuth(accessToken, refreshToken, user, sessionId);
  return user;
}

// 登录
export async function login(username: string, password: string): Promise<User> {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || '登录失败');
  }

  const { accessToken, refreshToken, user, sessionId } = data as AuthResponse;
  saveAuth(accessToken, refreshToken, user, sessionId);
  return user;
}

// 登出
export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (accessToken) {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (e) {
      // 忽略登出请求错误
      console.error('登出请求失败:', e);
    }
  }

  forceLogout();
}

// 刷新令牌
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    forceLogout();
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      forceLogout();
      return null;
    }

    const data = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    return data.accessToken;
  } catch {
    forceLogout();
    return null;
  }
}

// 获取当前用户信息
export async function getCurrentUser(): Promise<User | null> {
  let accessToken = getAccessToken();
  if (!accessToken) return null;

  let response = await fetch(`${API_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  // 如果令牌过期，尝试刷新
  if (response.status === 401) {
    const data = await response.json();
    if (data.code === 'TOKEN_EXPIRED') {
      accessToken = await refreshAccessToken();
      if (!accessToken) return null;
      
      response = await fetch(`${API_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
    }
  }

  if (!response.ok) {
    return null;
  }

  const user = await response.json();
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

// 更新用户信息
export async function updateProfile(data: { nickname?: string; avatar?: string }): Promise<void> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('未登录');

  const response = await fetch(`${API_BASE}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || '更新失败');
  }
}

// 修改密码
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('未登录');

  const response = await fetch(`${API_BASE}/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || '修改密码失败');
  }

  // 密码修改成功后清除认证信息，需要重新登录
  forceLogout();
}

// 带认证的 fetch 封装
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let accessToken = getAccessToken();

  const createHeaders = (token: string | null) => {
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  };

  const shouldForceLogout = async (response: Response) => {
    if (response.status === 401) {
      return true;
    }

    if (response.status === 403) {
      const data = await response.clone().json().catch(() => ({}));
      const errorMessage = typeof data.error === 'string' ? data.error : '';
      return errorMessage.includes('无效的令牌');
    }

    return false;
  };

  let response = await fetch(url, { ...options, headers: createHeaders(accessToken) });

  if (response.status === 401) {
    const data = await response.clone().json().catch(() => ({}));

    if (data.code === 'TOKEN_EXPIRED') {
      accessToken = await refreshAccessToken();
      if (accessToken) {
        response = await fetch(url, { ...options, headers: createHeaders(accessToken) });
        if (await shouldForceLogout(response)) {
          forceLogout();
        }
      }

      return response;
    }

    forceLogout();
    return response;
  }

  if (await shouldForceLogout(response)) {
    forceLogout();
  }

  return response;
}

// 会话信息类型
export interface UserSession {
  id: string;
  ipAddress: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser: string;
  os: string;
  createdAt: number;
  expiresAt: number;
  isCurrent: boolean;
}

// 获取所有登录会话
export async function getSessions(): Promise<UserSession[]> {
  const accessToken = getAccessToken();
  const sessionId = getSessionId();
  if (!accessToken) throw new Error('未登录');

  const response = await authFetch(`${API_BASE}/sessions`, {
    headers: { 
      'X-Session-Id': sessionId || ''
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('登录已过期，请重新登录');
    }
    throw new Error('获取会话列表失败');
  }

  return response.json();
}

// 删除指定会话（踢出设备）
export async function removeSession(sessionId: string): Promise<void> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('未登录');

  const response = await authFetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || '删除会话失败');
  }
}

// 删除所有其他会话
export async function removeOtherSessions(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!getAccessToken()) throw new Error('未登录');

  const response = await authFetch(`${API_BASE}/sessions`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentRefreshToken: refreshToken }),
  });

  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || '删除会话失败');
  }
}
