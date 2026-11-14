/**
 * 任务动作执行器
 * 按任务类型执行备份/恢复、整理、推送与选择性推送，返回统一的执行结果
 */

import {
  Task,
  TaskExecutionResult,
  BackupAction,
  OrganizeAction,
  PushAction,
  SelectivePushAction,
  TriggerType,
} from '../types/task';
import backupService from './backup-service';
import organizeService from './organize-service';
import storageService from '../utils/storage-service';
import githubService, { isRetryableGitHubError } from './github-service';

/**
 * 执行备份操作
 * @param task 任务对象
 * @returns 执行结果
 */
export async function executeBackupAction(task: Task): Promise<TaskExecutionResult> {
  console.log(`执行备份任务: ${task.id}, 操作类型: ${(task.action as BackupAction).operation || 'backup'}`);
  const backupAction = task.action as BackupAction;

  try {
    // 安全策略：恢复属于高风险操作，必须是手动触发任务
    if (backupAction.operation === 'restore' && task.trigger.type !== TriggerType.MANUAL) {
      return {
        success: false,
        timestamp: Date.now(),
        error: '恢复书签属于高风险操作，必须使用手动触发任务',
        details: '请将任务触发器设置为“手动触发”，并在执行前确认备份文件来源与内容',
      };
    }

    // 获取GitHub凭据
    const credentialsResult = await storageService.getGitHubCredentials();

    if (!credentialsResult.success || !credentialsResult.data) {
      console.error(`任务${task.id}执行失败: 未找到GitHub凭据`);
      return {
        success: false,
        timestamp: Date.now(),
        error: '未找到GitHub凭据，请先在“概览”页配置GitHub账号',
        details: '请打开扩展的“概览”页面，完成GitHub账号授权后再执行此任务'
      };
    }

    const credentials = credentialsResult.data;

    // 获取GitHub用户名并验证凭据有效性
    let username = 'user'; // 默认占位符
    try {
      console.log(`验证GitHub凭据...`);
      const userResult = await githubService.validateCredentials(credentials);
      username = userResult.login;
      console.log(`GitHub凭据验证成功，用户: ${username}`);
    } catch (error) {
      console.error(`GitHub凭据验证失败:`, error);
      // 网络/服务端错误导致验证失败属临时性失败，可重试，并给出明确的网络错误提示；
      // 凭据错误（401 等）不可重试，保持原有凭据错误消息
      if (isRetryableGitHubError(error)) {
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: `GitHub凭据验证失败（网络或服务端错误）: ${error instanceof Error ? error.message : String(error)}`,
          details: '网络异常导致GitHub凭据验证失败，请检查网络连接后重试',
        };
      }
      return {
        success: false,
        timestamp: Date.now(),
        retryable: false,
        error: `GitHub凭据无效或已过期: ${error instanceof Error ? error.message : String(error)}`,
        details: '请重新登录GitHub账号，更新授权信息后再执行此任务',
      };
    }

    // 根据操作类型执行不同的操作
    if (backupAction.operation === 'backup' || !backupAction.operation) {
      // 执行备份操作 (上传)
      console.log(`开始执行备份操作，上传书签到GitHub...`);
      const backupResult = await backupService.backupToGitHub(
        credentials,
        username
      );

      if (!backupResult.success) {
        console.error(`GitHub备份失败:`, backupResult.error);
        return {
          success: false,
          timestamp: Date.now(),
          // 结构化可重试性标记：网络/限流等临时性失败可重试，凭据/配置等错误不可重试
          retryable: backupResult.retryable,
          error: `GitHub备份失败: ${backupResult.error}`,
          details: '备份过程中发生错误，请检查网络连接和GitHub仓库权限'
        };
      }

      console.log(`备份成功完成，书签数:`, backupResult.data?.bookmarksCount);
      return {
        success: true,
        timestamp: Date.now(),
        details: `成功备份书签到GitHub: ${backupResult.data?.fileUrl || '无文件URL'}${backupResult.data?.bookmarksCount ? `，包含 ${backupResult.data.bookmarksCount} 个书签` : ''
          }`
      };
    } else if (backupAction.operation === 'restore') {
      // 执行恢复操作 (下载)
      const useTimestampedFile = !!backupAction.options?.backupFilePath;
      const timestampedFilePath = backupAction.options?.backupFilePath;

      console.log(`开始执行恢复操作，从GitHub下载书签`,
        useTimestampedFile ? `，使用指定文件: ${timestampedFilePath}` : '，使用最新文件');

      const restoreResult = await backupService.restoreFromGitHub(
        credentials,
        username,
        useTimestampedFile,
        timestampedFilePath
      );

      if (!restoreResult.success) {
        console.error(`从GitHub恢复失败:`, restoreResult.error);
        return {
          success: false,
          timestamp: Date.now(),
          // 结构化可重试性标记：网络/限流等临时性失败可重试
          retryable: restoreResult.retryable,
          error: `从GitHub恢复失败: ${restoreResult.error}`,
          details: '恢复过程中发生错误，请检查备份文件是否存在和有效'
        };
      }

      console.log(`恢复成功完成，书签数:`, restoreResult.data?.bookmarksCount);
      return {
        success: true,
        timestamp: Date.now(),
        details: `成功从GitHub恢复书签${restoreResult.data?.bookmarksCount ? `，恢复了 ${restoreResult.data.bookmarksCount} 个书签` : ''
          }`
      };
    } else {
      console.error(`不支持的备份操作: ${backupAction.operation}`);
      return {
        success: false,
        timestamp: Date.now(),
        error: `不支持的备份操作: ${backupAction.operation}`,
        details: '任务配置错误，请修改任务设置中的操作类型'
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`备份/恢复任务执行异常:`, errorMessage);

    return {
      success: false,
      timestamp: Date.now(),
      // 结构化可重试性标记：网络/限流等临时性失败可重试
      retryable: isRetryableGitHubError(error),
      error: `备份/恢复失败: ${errorMessage}`,
      details: '执行过程中发生未预期的错误，请检查控制台日志获取更多信息'
    };
  }
}

/**
 * 执行整理操作
 * @param task 任务对象
 * @returns 执行结果
 */
export async function executeOrganizeAction(task: Task): Promise<TaskExecutionResult> {
  console.log(`执行整理任务: ${task.id}`);
  const organizeAction = task.action as OrganizeAction;

  try {
    // 验证操作数组是否有效
    if (!organizeAction.operations || !Array.isArray(organizeAction.operations) || organizeAction.operations.length === 0) {
      throw new Error('整理操作数组为空或无效');
    }

    // 使用organizeService执行书签整理操作
    const results = await organizeService.organizeBookmarks(organizeAction.operations);

    // 汇总处理结果
    let successCount = 0;
    let failureCount = 0;
    let processedBookmarksCount = 0;
    let details: string[] = [];

    results.forEach(result => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      processedBookmarksCount += result.processedCount;
      details.push(result.details);
    });

    // 生成总结果
    const allOperationsSucceeded = failureCount === 0;
    return {
      success: allOperationsSucceeded,
      timestamp: Date.now(),
      details: `执行了 ${organizeAction.operations.length} 个整理操作，成功 ${successCount} 个，失败 ${failureCount} 个，处理了 ${processedBookmarksCount} 个书签。详情: ${details.join(' | ')}`,
      error: allOperationsSucceeded ? undefined : `${failureCount} 个操作失败，请检查详情`
    };
  } catch (error) {
    return {
      success: false,
      timestamp: Date.now(),
      error: `整理失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 执行推送书签操作
 * @param task 任务对象
 * @returns 执行结果
 */
export async function executePushAction(task: Task): Promise<TaskExecutionResult> {
  console.log(`执行推送书签任务: ${task.id}`);
  const pushAction = task.action as PushAction;

  try {
    // 获取GitHub凭据
    const credentialsResult = await storageService.getGitHubCredentials();

    if (!credentialsResult.success || !credentialsResult.data) {
      console.error(`任务${task.id}执行失败: 未找到GitHub凭据`);
      return {
        success: false,
        timestamp: Date.now(),
        error: '未找到GitHub凭据，请先在“概览”页配置GitHub账号',
        details: '请打开扩展的“概览”页面，完成GitHub账号授权后再执行此任务'
      };
    }

    const credentials = credentialsResult.data;

    // 获取GitHub用户名并验证凭据有效性
    let username = 'user'; // 默认占位符
    try {
      console.log(`验证GitHub凭据...`);
      const userResult = await githubService.validateCredentials(credentials);
      username = userResult.login;
      console.log(`GitHub凭据验证成功，用户: ${username}`);
    } catch (error) {
      console.error(`GitHub凭据验证失败:`, error);
      // 网络/服务端错误导致验证失败属临时性失败，可重试，并给出明确的网络错误提示；
      // 凭据错误（401 等）不可重试，保持原有凭据错误消息
      if (isRetryableGitHubError(error)) {
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: `GitHub凭据验证失败（网络或服务端错误）: ${error instanceof Error ? error.message : String(error)}`,
          details: '网络异常导致GitHub凭据验证失败，请检查网络连接后重试',
        };
      }
      return {
        success: false,
        timestamp: Date.now(),
        retryable: false,
        error: `GitHub凭据无效或已过期: ${error instanceof Error ? error.message : String(error)}`,
        details: '请重新登录GitHub账号，更新授权信息后再执行此任务',
      };
    }

    // 执行推送书签操作
    console.log(`开始执行推送书签操作，目标仓库: ${pushAction.options.repoName}/${pushAction.options.folderPath}...`);
    const pushResult = await backupService.pushBookmarksToGitHub(
      credentials,
      username,
      pushAction.options.repoName,
      pushAction.options.folderPath,
      pushAction.options.commitMessage
    );

    if (!pushResult.success) {
      console.error(`推送书签失败:`, pushResult.error);
      return {
        success: false,
        timestamp: Date.now(),
        // 结构化可重试性标记：网络/限流等临时性失败可重试
        retryable: pushResult.retryable,
        error: `推送书签失败: ${pushResult.error}`,
        details: '推送过程中发生错误，请检查网络连接和GitHub仓库权限'
      };
    }

    console.log(`推送书签成功完成，文件URL:`, pushResult.data?.fileUrl);
    return {
      success: true,
      timestamp: Date.now(),
      details: `成功推送书签到GitHub: ${pushResult.data?.fileUrl || '无文件URL'}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`推送书签任务执行异常:`, errorMessage);

    return {
      success: false,
      timestamp: Date.now(),
      // 结构化可重试性标记：网络/限流等临时性失败可重试
      retryable: isRetryableGitHubError(error),
      error: `推送书签失败: ${errorMessage}`,
      details: '执行过程中发生未预期的错误，请检查控制台日志获取更多信息'
    };
  }
}

/**
 * 执行选择性推送
 * @param task 任务对象
 * @returns 执行结果
 */
export async function executeSelectivePush(task: Task): Promise<TaskExecutionResult> {
  console.log(`执行选择性推送任务: ${task.id}`);
  const selectivePushAction = task.action as SelectivePushAction;

  try {
    // 1. 验证selections不为空
    if (!selectivePushAction.options.selections || selectivePushAction.options.selections.length === 0) {
      return {
        success: false,
        timestamp: Date.now(),
        error: '未选择任何书签',
        details: '请在任务配置中选择至少一个书签或文件夹'
      };
    }

    // 2. 获取GitHub凭据
    const credentialsResult = await storageService.getGitHubCredentials();

    if (!credentialsResult.success || !credentialsResult.data) {
      console.error(`任务${task.id}执行失败: 未找到GitHub凭据`);
      return {
        success: false,
        timestamp: Date.now(),
        error: '未找到GitHub凭据，请先在“概览”页配置GitHub账号',
        details: '请打开扩展的“概览”页面，完成GitHub账号授权后再执行此任务'
      };
    }

    const credentials = credentialsResult.data;

    // 3. 验证GitHub凭据
    let username = 'user'; // 默认占位符
    try {
      console.log(`验证GitHub凭据...`);
      const userResult = await githubService.validateCredentials(credentials);
      username = userResult.login;
      console.log(`GitHub凭据验证成功，用户: ${username}`);
    } catch (error) {
      console.error(`GitHub凭据验证失败:`, error);
      // 网络/服务端错误导致验证失败属临时性失败，可重试，并给出明确的网络错误提示；
      // 凭据错误（401 等）不可重试，保持原有凭据错误消息
      if (isRetryableGitHubError(error)) {
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: `GitHub凭据验证失败（网络或服务端错误）: ${error instanceof Error ? error.message : String(error)}`,
          details: '网络异常导致GitHub凭据验证失败，请检查网络连接后重试',
        };
      }
      return {
        success: false,
        timestamp: Date.now(),
        retryable: false,
        error: `GitHub凭据无效或已过期: ${error instanceof Error ? error.message : String(error)}`,
        details: '请重新登录GitHub账号，更新授权信息后再执行此任务',
      };
    }

    // 4. 使用BackupService生成HTML
    console.log(`生成选择性书签HTML，选中数量: ${selectivePushAction.options.selections.length}...`);
    const html = await backupService.generateSelectiveHtml(selectivePushAction.options.selections);

    // 5. 生成文件名(使用时间戳)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `selective-bookmarks-${timestamp}.html`;

    // 6. 使用GitHubService上传
    const folderPath = selectivePushAction.options.folderPath || '';
    const filePath = folderPath ? `${folderPath}/${filename}` : filename;
    const commitMessage = selectivePushAction.options.commitMessage || '选择性推送书签';

    console.log(`开始上传到GitHub，目标路径: ${filePath}...`);
    await githubService.createOrUpdateFile(
      credentials,
      username,
      selectivePushAction.options.repoName,
      filePath,
      html,
      commitMessage
    );

    console.log(`选择性推送完成:`, filePath);
    return {
      success: true,
      timestamp: Date.now(),
      details: `成功推送 ${selectivePushAction.options.selections.length} 个选中书签到 ${selectivePushAction.options.repoName}/${filePath}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`选择性推送任务执行异常:`, errorMessage);

    return {
      success: false,
      timestamp: Date.now(),
      // 结构化可重试性标记：网络/限流等临时性失败可重试
      retryable: isRetryableGitHubError(error),
      error: `选择性推送失败: ${errorMessage}`,
      details: '执行过程中发生未预期的错误，请检查控制台日志获取更多信息'
    };
  }
}
