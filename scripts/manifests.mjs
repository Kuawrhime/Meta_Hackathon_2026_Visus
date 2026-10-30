// Per-browser manifest generation from one shared definition.
export function buildManifest(browser) {
  const base = {
    manifest_version: 3,
    name: 'VISUS — See Words. Learn Worlds.',
    short_name: 'VISUS',
    version: '1.0.0',
    description: 'VISUS — See words. Learn worlds. Learn languages by reading the real web: local-first vocabulary highlighting, dictionary, books and video subtitles.',
    default_locale: 'en',
    icons: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
    action: { default_popup: 'popup.html', default_title: 'VISUS', default_icon: { 16: 'icons/icon16.png', 32: 'icons/icon32.png' } },
    options_ui: { page: 'dashboard.html', open_in_tab: true },
    permissions: ['storage', 'activeTab', 'contextMenus', 'alarms'],
    optional_permissions: ['tabs'],
    host_permissions: [],
    optional_host_permissions: ['https://*.youtube.com/*', 'https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*'],
    content_scripts: [{ matches: ['http://*/*', 'https://*/*'], js: ['content.js'], run_at: 'document_idle' }],
    web_accessible_resources: [{ resources: ['dashboard.html', 'dictionaries/*', 'images/*'], matches: ['<all_urls>'] }],
    commands: { _execute_action: { suggested_key: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' }, description: 'Open VISUS' } },
  };
  if (browser === 'firefox') {
    return {
      ...base,
      // Firefox MV3 uses an event page (background scripts), not a service worker.
      background: { scripts: ['background.js'], type: 'module' },
      // Gecko add-on ID kept stable from the Lingua Flow era so existing Firefox installs keep their data.
      browser_specific_settings: { gecko: { id: 'lingua-flow@example.local', strict_min_version: '128.0' } },
      sidebar_action: { default_panel: 'dashboard.html', default_title: 'VISUS' },
    };
  }
  // Chrome / Edge / Brave share the MV3 service-worker manifest.
  return { ...base, background: { service_worker: 'background.js', type: 'module' }, minimum_chrome_version: '116' };
}
