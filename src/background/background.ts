// MarksVault 后台脚本
// 负责处理事件监听和后台任务

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('MarksVault 扩展已安装');
    // 初始化存储
    chrome.storage.local.set({
      settings: {
        isDarkMode: false,
        syncEnabled: false,
      },
      bookmarks: {
        lastUpdated: null,
        customData: {},
      }
    });
  } else if (details.reason === 'update') {
    console.log('MarksVault 扩展已更新到版本 ' + chrome.runtime.getManifest().version);
  }
});

// 可以添加更多的事件监听器和后台功能
// 例如：定期同步、处理消息等

export {}; 