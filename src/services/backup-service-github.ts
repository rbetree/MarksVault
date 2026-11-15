import { GitHubCredentials } from '../utils/storage-service';
import githubService, { GitHubApiError } from './github-service';

export type RepositoryFile = Awaited<ReturnType<typeof githubService.getRepositoryFiles>>[number];

interface RepositoryLogMessages {
  existedLog: string;
  createFailedLog: string;
  recheckedExistsLog: string;
}

/**
 * 确保目标仓库存在；不存在时创建，并处理并发创建导致的“仓库已存在”情况。
 */
export async function ensureRepositoryExists(
  credentials: GitHubCredentials,
  username: string,
  repoName: string,
  messages: RepositoryLogMessages
): Promise<void> {
  const repoExists = await githubService.repoExists(credentials, username, repoName);
  if (repoExists) {
    return;
  }

  try {
    const createRepoResult = await githubService.createRepo(credentials, repoName, true);

    // 检查创建结果中是否有_repoExisted标记，表示仓库已存在但成功获取了信息
    if (createRepoResult._repoExisted) {
      console.log(messages.existedLog);
    } else {
      // 给新创建的仓库一些时间初始化
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (repoError) {
    // 如果创建仓库失败，再次检查仓库是否存在
    console.error(messages.createFailedLog, repoError);
    const recheckedExists = await githubService.repoExists(credentials, username, repoName);

    if (!recheckedExists) {
      // 如果确实不存在，则抛出原始错误
      throw repoError;
    } else {
      console.log(messages.recheckedExistsLog);
    }
  }
}

export async function repositoryExists(
  credentials: GitHubCredentials,
  username: string,
  repoName: string
): Promise<boolean> {
  return githubService.repoExists(credentials, username, repoName);
}

export async function listRepositoryFiles(
  credentials: GitHubCredentials,
  username: string,
  repoName: string,
  path: string
): Promise<RepositoryFile[]> {
  return githubService.getRepositoryFiles(credentials, username, repoName, path);
}

export async function readRepositoryFileContent(
  credentials: GitHubCredentials,
  username: string,
  repoName: string,
  path: string
): Promise<string> {
  const fileData = await githubService.getFileContent(credentials, username, repoName, path);
  return fileData.content;
}

/**
 * 查询仓库中已有文件的 sha
 * GitHub Contents API 更新已有文件时必须携带 sha，否则返回 422；目录不存在时返回 undefined
 */
export async function findRepositoryFileSha(
  credentials: GitHubCredentials,
  username: string,
  repoName: string,
  path: string
): Promise<string | undefined> {
  const separatorIndex = path.lastIndexOf('/');
  const folderPath = separatorIndex >= 0 ? path.slice(0, separatorIndex) : '';
  const fileName = separatorIndex >= 0 ? path.slice(separatorIndex + 1) : path;

  try {
    const files = await githubService.getRepositoryFiles(credentials, username, repoName, folderPath);
    return files.find(file => file.name === fileName)?.sha;
  } catch (error) {
    // 目录尚不存在等同于目标文件不存在，上传会走新建分支
    if (error instanceof GitHubApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

export async function writeRepositoryFile(
  credentials: GitHubCredentials,
  username: string,
  repoName: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<any> {
  // 仅在更新已有文件时携带 sha，保持新建文件调用与历史行为一致
  if (sha) {
    return githubService.createOrUpdateFile(credentials, username, repoName, path, content, message, sha);
  }
  return githubService.createOrUpdateFile(credentials, username, repoName, path, content, message);
}

export async function deleteRepositoryFile(
  credentials: GitHubCredentials,
  username: string,
  repoName: string,
  path: string,
  message: string,
  sha: string
): Promise<void> {
  await githubService.deleteFile(credentials, username, repoName, path, message, sha);
}
