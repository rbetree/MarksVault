const QUERY_SPACE_REGEX = /\s+/g;

/**
 * 统一搜索文本：去首尾空白、合并多空格、转小写、兼容全角字符。
 */
export const normalizeSearchText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  let normalized = trimmed;
  try {
    normalized = normalized.normalize('NFKC');
  } catch {
    // 兼容极少数不支持 Unicode normalize 的运行环境
  }

  return normalized.toLowerCase().replace(QUERY_SPACE_REGEX, ' ');
};

const splitQueryTerms = (normalizedQuery: string): string[] => {
  return normalizedQuery.split(' ').map(term => term.trim()).filter(Boolean);
};

/**
 * 非连续匹配评分（按字符顺序匹配）。
 */
const getSubsequenceScore = (query: string, target: string): number => {
  if (!query || !target) {
    return 0;
  }

  let queryIndex = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;
  let continuousMatches = 0;

  for (let i = 0; i < target.length && queryIndex < query.length; i++) {
    if (target[i] !== query[queryIndex]) {
      continue;
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = i;
    }

    if (lastMatchIndex === i - 1) {
      continuousMatches += 1;
    }

    lastMatchIndex = i;
    queryIndex += 1;
  }

  if (queryIndex !== query.length || firstMatchIndex === -1 || lastMatchIndex === -1) {
    return 0;
  }

  const spanLength = Math.max(lastMatchIndex - firstMatchIndex + 1, 1);
  const compactness = query.length / spanLength;
  const coverage = query.length / target.length;
  const continuity = continuousMatches / query.length;

  return Math.round(compactness * 35 + coverage * 25 + continuity * 30);
};

const getFieldScore = (queryTerm: string, normalizedField: string, isTitle: boolean): number => {
  if (!queryTerm || !normalizedField) {
    return 0;
  }

  if (normalizedField === queryTerm) {
    return isTitle ? 260 : 220;
  }

  if (normalizedField.startsWith(queryTerm)) {
    return (isTitle ? 220 : 180) - Math.min(normalizedField.length - queryTerm.length, 40) * 0.2;
  }

  const containsIndex = normalizedField.indexOf(queryTerm);
  if (containsIndex >= 0) {
    return (isTitle ? 180 : 150) - Math.min(containsIndex, 50) * 0.8;
  }

  // 单字符查询不做模糊匹配，避免噪音结果过多。
  if (queryTerm.length < 2) {
    return 0;
  }

  const subsequenceScore = getSubsequenceScore(queryTerm, normalizedField);
  if (subsequenceScore <= 0) {
    return 0;
  }

  return (isTitle ? 95 : 70) + subsequenceScore;
};

/**
 * 计算书签项的模糊匹配分数（越大越相关，0 表示不匹配）。
 */
export const getBookmarkFuzzyScoreByNormalizedQuery = (normalizedQuery: string, title: string, url?: string): number => {
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedTitle = normalizeSearchText(title || '');
  const normalizedUrl = normalizeSearchText(url || '');

  if (!normalizedTitle && !normalizedUrl) {
    return 0;
  }

  const terms = splitQueryTerms(normalizedQuery);
  if (terms.length === 0) {
    return 0;
  }

  let totalScore = 0;

  // 多关键字策略：每个 term 都必须命中（AND 语义）。
  for (const term of terms) {
    const titleScore = getFieldScore(term, normalizedTitle, true);
    const urlScore = getFieldScore(term, normalizedUrl, false);
    const termBestScore = Math.max(titleScore, urlScore);

    if (termBestScore <= 0) {
      return 0;
    }

    totalScore += termBestScore;
  }

  // 全 query 直接命中加权，帮助“完整词组”优先。
  if (normalizedTitle.includes(normalizedQuery)) {
    totalScore += 40;
  } else if (normalizedUrl.includes(normalizedQuery)) {
    totalScore += 20;
  }

  return Math.round(totalScore);
};

/**
 * 计算书签项的模糊匹配分数（对外入口，内部会先归一化 query）。
 */
export const getBookmarkFuzzyScore = (query: string, title: string, url?: string): number => {
  const normalizedQuery = normalizeSearchText(query);
  return getBookmarkFuzzyScoreByNormalizedQuery(normalizedQuery, title, url);
};
