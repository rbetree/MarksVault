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

  /**
   * 创建或更新仓库文件
   * @param credentials GitHub凭据
   * @param owner 仓库所有者用户名
   * @param repo 仓库名称
   * @param path 文件路径
   * @param content 文件内容
   * @param message 提交消息
   * @param sha 如果更新现有文件则需要提供此参数
   * @returns 创建或更新的文件信息
   */
  async createOrUpdateFile(
    credentials: GitHubCredentials,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<any> {
    const headers = this.getAuthHeaders(credentials);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    
    // Base64编码内容
    const contentEncoded = btoa(unescape(encodeURIComponent(content)));
    
    const body: any = {
      message,
      content: contentEncoded,
    };
    
    // 如果提供了SHA，添加到请求体中（表示更新现有文件）
    if (sha) {
      body.sha = sha;
    }
    
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Creating/updating file failed:', error);
      throw error;
    }
  }
  
  /**
   * 获取仓库文件内容
   * @param credentials GitHub凭据
   * @param owner 仓库所有者用户名
   * @param repo 仓库名称
   * @param path 文件路径
   * @returns 文件内容和元数据
   */
  async getFileContent(
    credentials: GitHubCredentials,
    owner: string,
    repo: string,
    path: string
  ): Promise<{ content: string; sha: string; metadata: any }> {
    const headers = this.getAuthHeaders(credentials);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        // 处理404特殊情况（文件不存在）
        if (response.status === 404) {
          throw new Error('File not found');
        }
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      // GitHub返回的内容是Base64编码的
      const content = decodeURIComponent(escape(atob(data.content)));
      
      return {
        content,
        sha: data.sha,
        metadata: {
          name: data.name,
          path: data.path,
          size: data.size,
          url: data.html_url,
          downloadUrl: data.download_url
        }
      };
    } catch (error) {
      console.error('Getting file content failed:', error);
      throw error;
    }
  }

  /**
   * 判断仓库是否存在
   * @param credentials GitHub凭据
   * @param owner 仓库所有者用户名
   * @param repo 仓库名称
   * @returns 仓库是否存在
   */
  async repoExists(
    credentials: GitHubCredentials,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const headers = this.getAuthHeaders(credentials);
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      return response.ok;
    } catch (error) {
      console.error('Checking repo existence failed:', error);
      return false;
    }
  }

  /**
   * 创建新仓库
   * @param credentials GitHub凭据
   * @param name 仓库名称
   * @param isPrivate 是否为私有仓库
   * @returns 创建的仓库信息
   */
  async createRepo(
    credentials: GitHubCredentials,
    name: string,
    isPrivate: boolean = true
  ): Promise<any> {
    const headers = this.getAuthHeaders(credentials);
    const url = `${this.baseUrl}/user/repos`;
    
    const body = {
      name,
      private: isPrivate,
      auto_init: true, // 自动初始化仓库
      description: 'MarksVault书签备份仓库'
    };
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // 特殊处理422错误 - 仓库名称已存在
        if (response.status === 422 && 
            errorData.errors && 
            errorData.errors.some((e: any) => e.code === 'custom' && e.field === 'name' && e.message.includes('already exists'))) {
          
          console.log('仓库名称已存在，尝试获取现有仓库');
          
          // 尝试获取现有仓库信息
          try {
            const ownerResponse = await this.validateCredentials(credentials);
            const ownerName = ownerResponse.login;
            
            const existingRepoResponse = await fetch(`${this.baseUrl}/repos/${ownerName}/${name}`, {
              method: 'GET',
              headers
            });
            
            if (existingRepoResponse.ok) {
              const repoData = await existingRepoResponse.json();
              console.log('已成功获取现有仓库信息');
              
              // 返回现有仓库的信息，添加一个标记表示这是现有仓库
              return {
                ...repoData,
                _repoExisted: true
              };
            }
          } catch (fetchError) {
            console.error('获取现有仓库失败:', fetchError);
            // 如果获取失败，继续抛出原始错误
          }
        }
        
        throw new Error(`创建仓库失败: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Creating repo failed:', error);
      throw error;
    }
  }

  /**
   * 获取仓库中的所有文件列表
   * @param credentials GitHub凭据
   * @param owner 仓库所有者用户名
   * @param repo 仓库名称
   * @param path 可选的目录路径
   * @returns 文件列表
   */
  async getRepositoryFiles(
    credentials: GitHubCredentials,
    owner: string,
    repo: string,
    path: string = ''
  ): Promise<Array<{name: string; path: string; sha: string; size: number; url: string; download_url: string; type: string}>> {
    const headers = this.getAuthHeaders(credentials);
    // 添加缓存控制头，确保每次都获取最新数据
    headers.append('Cache-Control', 'no-cache');
    headers.append('Pragma', 'no-cache');
    
    // 添加时间戳参数到URL，避免缓存
    const timestamp = new Date().getTime();
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?timestamp=${timestamp}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      // 过滤只返回文件（不包括目录）
      return Array.isArray(data) 
        ? data.filter(item => item.type === 'file') 
        : [];
    } catch (error) {
      console.error('Getting repository files failed:', error);
      throw error;
    }
  }

  /**
   * 删除仓库中的文件
   * @param credentials GitHub凭据
   * @param owner 仓库所有者用户名
   * @param repo 仓库名称
   * @param path 文件路径
   * @param message 提交消息
   * @param sha 文件的SHA标识符，必需
   * @returns 删除操作的结果
   */
  async deleteFile(
    credentials: GitHubCredentials,
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string
  ): Promise<any> {
    const headers = this.getAuthHeaders(credentials);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    
    const body = {
      message,
      sha
    };
    
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Deleting file failed:', error);
      throw error;
    }
  }
}

export default GitHubService.getInstance(); 