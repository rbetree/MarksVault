import { BookmarkItem, isBookmarkBarNode } from '../utils/bookmark-service';
import bookmarkService from '../utils/bookmark-service';
import { BookmarkSelection } from '../types/task';
import { getFaviconCacheKey, preloadFaviconIcons } from './backup-service-favicon';

/**
 * 创建HTML格式的书签数据
 * @returns HTML格式的书签数据
 */
export async function createHtmlBookmarkData(): Promise<string> {
  // 获取所有书签
  const bookmarksResult = await bookmarkService.getAllBookmarks();
  if (!bookmarksResult.success) {
    throw new Error(`获取书签失败: ${bookmarksResult.error}`);
  }

  const bookmarks = bookmarksResult.data as BookmarkItem[];
  const faviconByKey = await preloadFaviconIcons(bookmarks);

  // 创建标准的HTML书签格式
  let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
  html += '<!-- This is an automatically generated file.\n';
  html += '     It will be read and overwritten.\n';
  html += '     DO NOT EDIT! -->\n';
  html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
  html += '<TITLE>Bookmarks</TITLE>\n';
  html += '<H1>Bookmarks</H1>\n';
  html += '<DL><p>\n';

  // 判断是否为书签栏文件夹
  const isBookmarkBar = (item: BookmarkItem): boolean => {
    return isBookmarkBarNode(item);
  };

  // 递归生成书签HTML（异步）
  const generateBookmarkHtml = async (items: BookmarkItem[], indentLevel: number = 1, skipRootWrapper: boolean = true): Promise<string> => {
    const indent = '    '.repeat(indentLevel);
    let result = '';

    for (const item of items) {
      if (item.isFolder) {
        // 对于根节点的第一层，完全跳过根包装文件夹，直接处理其子节点
        if (skipRootWrapper && indentLevel === 1 && !isBookmarkBar(item)) {
          // 如果不是书签栏，直接递归处理子节点，不输出此节点的HTML
          if (item.children && item.children.length > 0) {
            result += await generateBookmarkHtml(item.children, indentLevel, false);
          }
          continue;
        }

        // 文件夹项 - 只添加 ADD_DATE 和 LAST_MODIFIED 属性
        const addDate = item.dateAdded ? Math.floor(item.dateAdded / 1000) : Math.floor(Date.now() / 1000);
        const lastModified = item.dateGroupModified ? Math.floor(item.dateGroupModified / 1000) : 0;

        // 检查是否为书签栏
        const personalToolbar = isBookmarkBar(item) ? ' PERSONAL_TOOLBAR_FOLDER="true"' : '';

        result += `${indent}<DT><H3 ADD_DATE="${addDate}" LAST_MODIFIED="${lastModified}"${personalToolbar}>${escapeHtml(item.title)}</H3>\n`;
        result += `${indent}<DL><p>\n`;

        if (item.children && item.children.length > 0) {
          result += await generateBookmarkHtml(item.children, indentLevel + 1, false);
        }

        result += `${indent}</DL><p>\n`;
      } else if (item.url) {
        // 书签项 - 只添加 ADD_DATE 和 ICON 属性（不添加 LAST_MODIFIED）
        const addDate = item.dateAdded ? Math.floor(item.dateAdded / 1000) : Math.floor(Date.now() / 1000);

        // 从预加载缓存读取 ICON，避免逐条串行网络请求。
        let iconAttr = '';
        try {
          const faviconKey = getFaviconCacheKey(item.url);
          const iconData = faviconByKey.get(faviconKey);
          if (iconData) {
            iconAttr = ` ICON="${iconData}"`;
          }
        } catch (error) {
          console.warn('Failed to fetch icon for', item.url, error);
        }

        result += `${indent}<DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${addDate}"${iconAttr}>${escapeHtml(item.title)}</A>\n`;
      }
    }

    return result;
  };

  html += await generateBookmarkHtml(bookmarks, 1, true);
  html += '</DL><p>\n';

  return html;
}

/**
 * HTML转义特殊字符
 * @param text 需要转义的文本
 * @returns 转义后的文本
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 根据选择的书签生成HTML
 * @param selections 用户选择的书签数组
 * @returns HTML字符串
 */
export async function generateSelectiveHtml(selections: BookmarkSelection[]): Promise<string> {
  // 1. 按customOrder排序
  const sortedSelections = sortSelections(selections);

  // 2. 生成HTML头部
  let html = generateHtmlHeader('选择性书签导出');

  // 3. 生成符合标准浏览器书签格式的结构
  // menav 的 bookmark-processor.js 会查找 PERSONAL_TOOLBAR_FOLDER 标记
  const now = Math.floor(Date.now() / 1000);
  html += '<DL><p>\n';
  html += `    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}" PERSONAL_TOOLBAR_FOLDER="true">书签栏</H3>\n`;
  html += '    <DL><p>\n';
  html += generateSelectiveBookmarkNodes(sortedSelections, 2);
  html += '    </DL><p>\n';
  html += '</DL><p>\n';

  return html;
}

/**
 * 排序书签选择
 */
function sortSelections(selections: BookmarkSelection[]): BookmarkSelection[] {
  return [...selections].sort((a, b) => {
    const orderA = a.customOrder ?? Infinity;
    const orderB = b.customOrder ?? Infinity;
    return orderA - orderB;
  });
}

/**
 * 递归生成书签节点HTML
 */
function generateSelectiveBookmarkNodes(selections: BookmarkSelection[], indent: number = 1): string {
  let html = '';
  const indentStr = '  '.repeat(indent);

  for (const selection of selections) {
    if (selection.type === 'folder') {
      // 文件夹节点
      html += `${indentStr}<DT><H3>${escapeHtml(selection.title)}</H3>\n`;
      if (selection.children && selection.children.length > 0) {
        html += `${indentStr}<DL><p>\n`;
        html += generateSelectiveBookmarkNodes(selection.children, indent + 1);
        html += `${indentStr}</DL><p>\n`;
      }
    } else {
      // 书签节点
      html += `${indentStr}<DT><A HREF="${escapeHtml(selection.url || '')}">${escapeHtml(selection.title)}</A>\n`;
    }
  }

  return html;
}

/**
 * 生成HTML头部
 */
function generateHtmlHeader(title: string): string {
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>${escapeHtml(title)}</TITLE>
<H1>${escapeHtml(title)}</H1>
`;
}
