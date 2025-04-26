import { GitHubCredentials, GitHubUser } from '../types/github';

export class GitHubService {
  private static instance: GitHubService;
  private baseUrl = 'https://api.github.com';
  
  private constructor() {}
  
  static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }
  
  /**
   * 验证GitHub认证凭据
   */
  async validateCredentials(credentials: GitHubCredentials): Promise<GitHubUser> {
    const headers = this.getAuthHeaders(credentials);
    
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const userData = await response.json();
      return userData as GitHubUser;
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      throw error;
    }
  }
  
  /**
   * 获取认证头信息
   */
  private getAuthHeaders(credentials: GitHubCredentials): Headers {
    const headers = new Headers();
    headers.append('Accept', 'application/vnd.github.v3+json');
    headers.append('Authorization', `token ${credentials.token}`);
    return headers;
  }
}

export default GitHubService.getInstance(); 