use anyhow::{anyhow, Result};
use log::{error, info, warn};
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;
use winit::dpi::PhysicalSize;
use winit::event::{Event, WindowEvent, ElementState, MouseButton, KeyEvent};
use winit::keyboard::{PhysicalKey, KeyCode};
use winit::event_loop::{ControlFlow, EventLoop};
use winit::window::{Window, WindowBuilder};

use crate::dom_api::{DomApiBridge, setup_dom_js_api};
use crate::event_handler::{EventManager, EventType, EventData, MouseEventData};
use crate::js_engine::JsEngine;
use crate::network::NetworkManager;
use crate::renderer::PageRenderer;
use crate::tab::Tab;
use crate::toolbar::{Toolbar, ToolbarAction, TOOLBAR_HEIGHT, TAB_BAR_HEIGHT};
use webgpu_web_renderer::bridge::WebNativeBridge;
use webgpu_web_renderer::Engine;

/// 简单浏览器主结构
pub struct SimpleBrowser {
    /// 事件循环
    event_loop: Option<EventLoop<()>>,
    /// 窗口
    window: Arc<Window>,
    /// 页面渲染器（共享）
    page_renderer: PageRenderer,
    /// 标签页列表
    tabs: Vec<Tab>,
    /// 当前活动标签页索引
    active_tab_index: usize,
    /// 网络管理器
    network: NetworkManager,
    /// Windows 原生工具栏
    #[cfg(windows)]
    toolbar: Option<Toolbar>,
    /// 需要重新渲染
    needs_redraw: bool,
}

impl SimpleBrowser {
    /// 创建新的浏览器实例
    pub fn new(width: u32, height: u32) -> Result<Self> {
        info!("Creating Simple Browser ({}x{})...", width, height);

        // 创建事件循环
        let event_loop = EventLoop::new()?;

        // 创建窗口
        let window = Arc::new(
            WindowBuilder::new()
                .with_title("Simple Browser")
                .with_inner_size(PhysicalSize::new(width, height))
                .build(&event_loop)?,
        );

        // 创建第一个标签页的引擎
        let content_height = height.saturating_sub(TOOLBAR_HEIGHT + TAB_BAR_HEIGHT);
        let engine = Engine::new(width, content_height);
        let engine = Rc::new(RefCell::new(engine));

        // 创建页面渲染器
        let page_renderer = pollster::block_on(PageRenderer::new(window.clone(), engine.clone()))?;

        // 创建 JavaScript 引擎
        let js_engine = JsEngine::new()?;

        // 创建网络管理器
        let network = NetworkManager::new();

        // 创建 DOM API 桥接
        let dom_bridge = DomApiBridge::new(engine.clone());

        // 创建事件管理器
        let event_manager = EventManager::new();

        // 创建第一个标签页
        let tab = Tab::new(
            engine.clone(),
            js_engine,
            dom_bridge,
            event_manager,
        );

        // 设置 DOM API 到 JS 引擎
        {
            let js = tab.js_engine.borrow();
            setup_dom_js_api(&js, tab.dom_bridge.clone())?;
        }

        // 创建 Windows 原生工具栏
        #[cfg(windows)]
        let toolbar = {
            let hwnd = get_hwnd_from_window(&window)?;
            let hwnd = windows::Win32::Foundation::HWND(hwnd as *mut _);
            match Toolbar::create(hwnd) {
                Ok(tb) => {
                    info!("Native toolbar created, height={}", tb.height());
                    Some(tb)
                }
                Err(e) => {
                    warn!("Failed to create native toolbar: {}, continuing without toolbar", e);
                    None
                }
            }
        };

        info!("Simple Browser created successfully");

        Ok(Self {
            event_loop: Some(event_loop),
            window,
            page_renderer,
            tabs: vec![tab],
            active_tab_index: 0,
            network,
            #[cfg(windows)]
            toolbar,
            needs_redraw: true,
        })
    }

    /// 创建新标签页
    pub fn new_tab(&mut self) -> Result<usize> {
        info!("Creating new tab...");

        let size = self.window.inner_size();
        let toolbar_h = self.get_toolbar_height();
        let content_height = size.height.saturating_sub(toolbar_h);

        // 创建新的引擎
        let engine = Engine::new(size.width, content_height);
        let engine = Rc::new(RefCell::new(engine));

        let js_engine = JsEngine::new()?;
        let dom_bridge = DomApiBridge::new(engine.clone());
        let event_manager = EventManager::new();

        let tab = Tab::new(
            engine.clone(),
            js_engine,
            dom_bridge,
            event_manager,
        );

        // 设置 DOM API
        {
            let js = tab.js_engine.borrow();
            setup_dom_js_api(&js, tab.dom_bridge.clone())?;
        }

        let index = self.tabs.len();
        self.tabs.push(tab);
        self.active_tab_index = index;

        // 更新工具栏标签按钮
        self.update_toolbar_tabs();

        info!("New tab created at index {}", index);
        Ok(index)
    }

    /// 关闭标签页
    pub fn close_tab(&mut self, index: usize) -> Result<()> {
        if self.tabs.len() <= 1 {
            info!("Cannot close the last tab");
            return Ok(());
        }

        if index >= self.tabs.len() {
            return Err(anyhow!("Tab index out of range: {}", index));
        }

        info!("Closing tab {}", index);
        self.tabs.remove(index);

        // 调整活动标签页索引
        if self.active_tab_index >= self.tabs.len() {
            self.active_tab_index = self.tabs.len() - 1;
        } else if self.active_tab_index > index {
            self.active_tab_index -= 1;
        } else if self.active_tab_index == index {
            self.active_tab_index = index.min(self.tabs.len() - 1);
        }

        // 切换到活动标签页的引擎
        self.switch_engine_to_active_tab();

        // 更新工具栏标签按钮
        self.update_toolbar_tabs();

        self.needs_redraw = true;
        Ok(())
    }

    /// 切换到指定标签页
    pub fn switch_tab(&mut self, index: usize) -> Result<()> {
        if index >= self.tabs.len() {
            return Err(anyhow!("Tab index out of range: {}", index));
        }

        if index == self.active_tab_index {
            return Ok(());
        }

        info!("Switching to tab {}", index);
        self.active_tab_index = index;

        // 切换引擎
        self.switch_engine_to_active_tab();

        // 更新地址栏
        let tab = &self.tabs[self.active_tab_index];
        #[cfg(windows)]
        if let Some(ref toolbar) = self.toolbar {
            toolbar.set_address_text(&simplify_url(&tab.current_url));
            toolbar.set_debug_text(&tab.current_url);
        }

        // 更新窗口标题
        self.window.set_title(&format!("{} - Simple Browser", tab.page_title));

        // 更新工具栏标签按钮
        self.update_toolbar_tabs();

        self.needs_redraw = true;
        Ok(())
    }

    /// 获取活动标签页
    pub fn active_tab(&self) -> &Tab {
        &self.tabs[self.active_tab_index]
    }

    /// 获取活动标签页（可变）
    fn active_tab_mut(&mut self) -> &mut Tab {
        &mut self.tabs[self.active_tab_index]
    }

    /// 将渲染引擎切换到活动标签页
    fn switch_engine_to_active_tab(&mut self) {
        let tab = &self.tabs[self.active_tab_index];
        self.page_renderer.set_engine(tab.engine.clone());
    }

    /// 获取工具栏总高度
    fn get_toolbar_height(&self) -> u32 {
        #[cfg(windows)]
        if let Some(ref toolbar) = self.toolbar {
            return toolbar.height();
        }
        TOOLBAR_HEIGHT + TAB_BAR_HEIGHT
    }

    /// 更新工具栏标签按钮
    fn update_toolbar_tabs(&mut self) {
        #[cfg(windows)]
        if let Some(ref mut toolbar) = self.toolbar {
            let titles: Vec<String> = self.tabs.iter()
                .map(|t| t.short_title())
                .collect();
            toolbar.update_tabs(&titles, self.active_tab_index);
        }
    }

    /// 导航到 URL（在活动标签页中）
    /// from_debug: 是否从调试面板导航
    pub fn navigate(&mut self, url: &str, from_debug: bool) -> Result<()> {
        info!("Navigating to: {} (from_debug: {})", url, from_debug);

        self.tabs[self.active_tab_index].current_url = url.to_string();
        self.tabs[self.active_tab_index].is_debug_tab = from_debug;

        // 获取资源
        let resource = self.network.fetch(url)?;

        // 根据内容类型处理
        let content_type = resource.content_type();

        if content_type.starts_with("text/html") {
            let html = resource.text()?;
            self.load_html(&html)?;
            
            // 提取页面标题
            if let Some(title) = extract_page_title(&html) {
                self.tabs[self.active_tab_index].page_title = title;
            }
        } else if content_type.starts_with("text/css") {
            self.load_css(&resource.text()?)?;
        } else if content_type.starts_with("application/javascript") {
            self.load_js(&resource.text()?)?;
        } else {
            warn!("Unsupported content type: {}", content_type);
        }

        // 更新窗口标题
        let tab = &self.tabs[self.active_tab_index];
        self.window.set_title(&format!("{} - Simple Browser", tab.page_title));

        // 更新地址栏（简化 URL）和调试面板（完整 URL）
        #[cfg(windows)]
        if let Some(ref toolbar) = self.toolbar {
            toolbar.set_address_text(&simplify_url(url));
            toolbar.set_debug_text(url);
        }

        // 更新标签按钮
        self.update_toolbar_tabs();

        // 标记需要重绘
        self.needs_redraw = true;
        self.page_renderer.request_redraw();

        Ok(())
    }

    /// 加载 HTML 内容
    pub fn load_html(&mut self, html: &str) -> Result<()> {
        info!("Loading HTML ({} bytes)", html.len());

        // 设置 HTML 到渲染引擎
        {
            let tab = &self.tabs[self.active_tab_index];
            let mut engine = tab.engine.borrow_mut();
            engine.set_html(html);
        }

        // 提取并执行内联 JavaScript
        {
            let tab = &self.tabs[self.active_tab_index];
            let mut start = 0;
            while let Some(script_start) = html[start..].find("<script") {
                let script_start = start + script_start;

                if let Some(content_start) = html[script_start..].find(">") {
                    let content_start = script_start + content_start + 1;

                    if let Some(script_end) = html[content_start..].find("</script>") {
                        let script_end = content_start + script_end;
                        let script_content = &html[content_start..script_end];

                        if !script_content.trim().is_empty() {
                            let js_engine = tab.js_engine.borrow();
                            if let Err(e) = js_engine.eval(script_content, false) {
                                error!("Script execution error: {}", e);
                            }
                        }

                        start = script_end + 9;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }

        // 触发 load 事件
        {
            let tab = &self.tabs[self.active_tab_index];
            let mut event_manager = tab.event_manager.borrow_mut();
            event_manager.trigger_global_event(EventType::Load, EventData::None);
        }

        self.tabs[self.active_tab_index].needs_redraw = true;
        Ok(())
    }

    /// 加载 CSS 内容
    pub fn load_css(&mut self, css: &str) -> Result<()> {
        info!("Loading CSS ({} bytes)", css.len());

        {
            let tab = &self.tabs[self.active_tab_index];
            let mut engine = tab.engine.borrow_mut();
            engine.set_css(css);
        }

        self.tabs[self.active_tab_index].needs_redraw = true;
        Ok(())
    }

    /// 加载并执行 JavaScript
    pub fn load_js(&mut self, js: &str) -> Result<()> {
        info!("Loading JavaScript ({} bytes)", js.len());

        {
            let tab = &self.tabs[self.active_tab_index];
            let js_engine = tab.js_engine.borrow();
            match js_engine.eval(js, false) {
                Ok(_) => {
                    info!("JavaScript executed successfully");
                }
                Err(e) => {
                    error!("JavaScript execution error: {}", e);
                }
            }
        }

        self.tabs[self.active_tab_index].needs_redraw = true;
        Ok(())
    }

    /// 处理点击事件
    fn handle_click(&mut self, x: f32, y: f32) {
        info!("Click at ({}, {})", x, y);

        let tab = &self.tabs[self.active_tab_index];

        // 使用渲染引擎进行点击测试
        let hit_node = {
            let engine = tab.engine.borrow();
            engine.hit_test(x, y)
        };

        if let Some(node) = hit_node {
            info!("Click hit node: {} (dom_id={})", node.tag_name, node.dom_node);

            {
                let mut event_manager = tab.event_manager.borrow_mut();
                let mouse_data = MouseEventData::new(x, y);
                event_manager.trigger_element_event(
                    node.dom_node,
                    EventType::Click,
                    EventData::Mouse(mouse_data),
                );
            }

            self.tabs[self.active_tab_index].needs_redraw = true;
        }
    }

    /// 处理工具栏按钮点击
    fn handle_toolbar_action(&mut self, action: ToolbarAction) {
        match action {
            ToolbarAction::Go => {
                #[cfg(windows)]
                if let Some(ref toolbar) = self.toolbar {
                    let url = toolbar.get_address_text();
                    if !url.is_empty() {
                        // 简单的 URL 补全
                        let url = if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("data:") && !url.starts_with("file:") {
                            if url.contains('.') && !url.contains(' ') {
                                format!("https://{}", url)
                            } else {
                                // 搜索查询
                                format!("https://www.bing.com/search?q={}", urlencoding::encode(&url))
                            }
                        } else {
                            url
                        };
                        let _ = self.navigate(&url, false); // 从地址栏导航，不是调试
                    }
                }
            }
            ToolbarAction::Back => {
                info!("Back navigation requested (not yet implemented)");
            }
            ToolbarAction::Forward => {
                info!("Forward navigation requested (not yet implemented)");
            }
            ToolbarAction::Refresh => {
                let url = self.tabs[self.active_tab_index].current_url.clone();
                if !url.is_empty() {
                    let from_debug = self.tabs[self.active_tab_index].is_debug_tab;
                    let _ = self.navigate(&url, from_debug);
                }
            }
            ToolbarAction::NewTab => {
                let _ = self.new_tab();
            }
            ToolbarAction::SwitchTab(index) => {
                let _ = self.switch_tab(index);
            }
            ToolbarAction::CloseTab(index) => {
                let _ = self.close_tab(index);
            }
            ToolbarAction::ToggleDebug => {
                #[cfg(windows)]
                if let Some(ref mut toolbar) = self.toolbar {
                    toolbar.toggle_debug_panel();
                    // 更新渲染器的工具栏高度
                    let toolbar_h = toolbar.height();
                    self.page_renderer.set_toolbar_height(toolbar_h);
                    // 请求重绘
                    self.needs_redraw = true;
                    self.page_renderer.request_redraw();
                }
            }
        }
    }

    /// 运行浏览器主循环
    pub fn run(mut self) -> Result<()> {
        info!("Starting browser main loop...");

        // 设置工具栏高度到渲染器
        let toolbar_h = self.get_toolbar_height();
        self.page_renderer.set_toolbar_height(toolbar_h);

        // 初始化页面渲染器
        self.page_renderer.initialize()?;

        // 初始调整工具栏大小
        #[cfg(windows)]
        if let Some(ref mut toolbar) = self.toolbar {
            let size = self.window.inner_size();
            toolbar.resize(size.width as i32);
        }

        // 初始更新标签按钮
        self.update_toolbar_tabs();

        let event_loop = self.event_loop.take().ok_or_else(|| anyhow!("Event loop already taken"))?;

        // 将 self 包装为 Rc<RefCell> 以便在闭包中使用
        let browser = Rc::new(RefCell::new(self));

        event_loop.run(move |event, elwt| {
            elwt.set_control_flow(ControlFlow::Wait);

            match event {
                Event::WindowEvent { event, .. } => {
                    match event {
                        WindowEvent::CloseRequested => {
                            info!("Window close requested");
                            elwt.exit();
                        }
                        WindowEvent::Resized(new_size) => {
                            info!("Window resized to {}x{}", new_size.width, new_size.height);
                            let mut browser = browser.borrow_mut();

                            // 调整渲染器
                            browser.page_renderer.resize(new_size);

                            // 调整工具栏
                            #[cfg(windows)]
                            if let Some(ref mut toolbar) = browser.toolbar {
                                toolbar.resize(new_size.width as i32);
                            }

                            browser.needs_redraw = true;
                        }
                        WindowEvent::MouseInput {
                            state: ElementState::Released,
                            button: MouseButton::Left,
                            ..
                        } => {
                            let mouse_pos = {
                                let brw = browser.borrow();
                                let tab = &brw.tabs[brw.active_tab_index];
                                tab.event_manager.borrow().mouse_position()
                            };
                            let mut brw = browser.borrow_mut();
                            brw.handle_click(mouse_pos.0, mouse_pos.1);
                        }
                        WindowEvent::CursorMoved { position, .. } => {
                            let brw = browser.borrow();
                            let tab = &brw.tabs[brw.active_tab_index];
                            tab.event_manager.borrow_mut().mouse_position = (position.x as f32, position.y as f32);
                        }
                        WindowEvent::KeyboardInput {
                            event: KeyEvent {
                                state: ElementState::Pressed,
                                physical_key: PhysicalKey::Code(KeyCode::Enter),
                                ..
                            },
                            ..
                        } => {
                            // 检查地址栏或调试面板是否有焦点
                            let brw = browser.borrow();
                            #[cfg(windows)]
                            let (address_focused, debug_focused) = brw.toolbar.as_ref()
                                .map(|t| (t.is_address_focused(), t.is_debug_focused()))
                                .unwrap_or((false, false));
                            #[cfg(not(windows))]
                            let (address_focused, debug_focused) = (false, false);
                            drop(brw);

                            if address_focused {
                                // 从地址栏导航 - 普通标签页
                                let mut brw = browser.borrow_mut();
                                brw.handle_toolbar_action(ToolbarAction::Go);
                            } else if debug_focused {
                                // 从调试面板导航 - 调试标签页
                                #[cfg(windows)]
                                {
                                    let url = browser.borrow().toolbar.as_ref()
                                        .map(|t| t.get_debug_text())
                                        .unwrap_or_default();
                                    if !url.is_empty() {
                                        let mut brw = browser.borrow_mut();
                                        let _ = brw.navigate(&url, true);
                                    }
                                }
                            }
                        }
                        WindowEvent::RedrawRequested => {
                            let mut brw = browser.borrow_mut();
                            if brw.needs_redraw {
                                // 检查活动标签页是否需要重绘
                                let idx = brw.active_tab_index;
                                if brw.tabs[idx].needs_redraw {
                                    if let Err(e) = brw.page_renderer.render() {
                                        error!("Render error: {}", e);
                                    }
                                    brw.tabs[idx].needs_redraw = false;
                                }
                                brw.needs_redraw = false;
                            }
                        }
                        _ => {}
                    }
                }
                Event::AboutToWait => {
                    let browser = browser.borrow();
                    if browser.needs_redraw {
                        browser.page_renderer.request_redraw();
                    }
                }
                _ => {}
            }
        })?;

        Ok(())
    }

    /// 获取当前 URL
    pub fn current_url(&self) -> &str {
        &self.active_tab().current_url
    }

    /// 获取页面标题
    pub fn page_title(&self) -> &str {
        &self.active_tab().page_title
    }

    /// 设置页面标题
    pub fn set_page_title(&mut self, title: &str) {
        self.active_tab_mut().page_title = title.to_string();
        self.window.set_title(&format!("{} - Simple Browser", title));
        self.update_toolbar_tabs();
    }

    /// 重新加载当前页面
    pub fn reload(&mut self) -> Result<()> {
        let url = self.tabs[self.active_tab_index].current_url.clone();
        let from_debug = self.tabs[self.active_tab_index].is_debug_tab;
        self.navigate(&url, from_debug)
    }

    /// 执行 JavaScript 代码
    pub fn execute_js(&self, code: &str) -> Result<String> {
        let tab = self.active_tab();
        let js_engine = tab.js_engine.borrow();
        js_engine.eval_as_string(code)
    }

    /// 获取 DOM 元素文本
    pub fn get_element_text(&self, selector: &str) -> Option<String> {
        let tab = self.active_tab();
        let bridge = tab.dom_bridge.borrow();
        bridge.query(selector).and_then(|id| bridge.text(id))
    }

    /// 获取标签页数量
    pub fn tab_count(&self) -> usize {
        self.tabs.len()
    }

    /// 获取活动标签页索引
    pub fn active_tab_index(&self) -> usize {
        self.active_tab_index
    }
}

/// 浏览器构建器
pub struct BrowserBuilder {
    width: u32,
    height: u32,
    title: String,
}

impl BrowserBuilder {
    pub fn new() -> Self {
        Self {
            width: 1280,
            height: 800,
            title: String::from("Simple Browser"),
        }
    }

    pub fn with_size(mut self, width: u32, height: u32) -> Self {
        self.width = width;
        self.height = height;
        self
    }

    pub fn with_title(mut self, title: &str) -> Self {
        self.title = title.to_string();
        self
    }

    pub fn build(self) -> Result<SimpleBrowser> {
        SimpleBrowser::new(self.width, self.height)
    }
}

impl Default for BrowserBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// 从 winit 窗口获取 Windows HWND
#[cfg(windows)]
fn get_hwnd_from_window(window: &Arc<Window>) -> Result<isize> {
    use raw_window_handle::HasWindowHandle;
    use raw_window_handle::RawWindowHandle;

    let handle = window.window_handle()
        .map_err(|e| anyhow!("Failed to get window handle: {}", e))?;

    match handle.as_raw() {
        RawWindowHandle::Win32(win32_handle) => {
            Ok(win32_handle.hwnd.get())
        }
        _ => Err(anyhow!("Not a Win32 window")),
    }
}

// ── 辅助函数 ──

/// 简化 URL 用于显示在地址栏
/// - data:... -> 显示 "data:..."
/// - http://example.com/path -> 显示 "example.com"
/// - https://example.com/path -> 显示 "example.com"
pub fn simplify_url(url: &str) -> String {
    if url.is_empty() {
        return String::new();
    }
    
    if url.starts_with("data:") {
        return "data:...".to_string();
    }
    
    if url.starts_with("http://") || url.starts_with("https://") {
        // 提取域名
        if let Ok(parsed) = url::Url::parse(url)
            && let Some(host) = parsed.host_str() {
                return host.to_string();
            }
        // 如果解析失败，使用简单字符串分割
        return url.split('/').nth(2).unwrap_or(url).to_string();
    }
    
    // 其他情况返回原 URL
    url.to_string()
}

/// 从 HTML 内容中提取页面标题
pub fn extract_page_title(html: &str) -> Option<String> {
    // 查找 <title> 标签
    let title_start = html.find("<title")?;
    let content_start = html[title_start..].find(">")? + title_start + 1;
    let title_end = html[content_start..].find("</title>")? + content_start;
    
    let title = &html[content_start..title_end];
    let title = title.trim();
    
    if title.is_empty() {
        None
    } else {
        Some(title.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simplify_url() {
        assert_eq!(simplify_url(""), "");
        assert_eq!(simplify_url("data:text/html,hello"), "data:...");
        assert_eq!(simplify_url("http://example.com/path"), "example.com");
        assert_eq!(simplify_url("https://example.com/path/to/page"), "example.com");
        assert_eq!(simplify_url("https://www.google.com/search?q=test"), "www.google.com");
        assert_eq!(simplify_url("file:///C:/test.html"), "file:///C:/test.html");
    }

    #[test]
    fn test_extract_page_title() {
        assert_eq!(
            extract_page_title("<html><head><title>Test Page</title></head></html>"),
            Some("Test Page".to_string())
        );
        assert_eq!(
            extract_page_title("<html><head><title>  Test Page  </title></head></html>"),
            Some("Test Page".to_string())
        );
        assert_eq!(
            extract_page_title("<html><head></head></html>"),
            None
        );
    }
}
