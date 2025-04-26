export interface GitHubCredentials {
  token: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
}

// 认证状态枚举
export enum AuthStatus {
  INITIAL = 'initial',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  FAILED = 'failed',
} 