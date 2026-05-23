//! Tab 模块 — 浏览器标签页结构
//!
//! 每个 Tab 包含独立的渲染引擎、JS 引擎、DOM 桥接和事件管理器。

use crate::dom_api::DomApiBridge;
use crate::event_handler::EventManager;
use crate::js_engine::JsEngine;
use webgpu_web_renderer::Engine;

use std::cell::RefCell;
use std::rc::Rc;

/// 浏览器标签页
pub struct Tab {
    /// WebGPU 渲染引擎
    pub engine: Rc<RefCell<Engine>>,
    /// JavaScript 引擎
    pub js_engine: Rc<RefCell<JsEngine>>,
    /// DOM API 桥接
    pub dom_bridge: Rc<RefCell<DomApiBridge>>,
    /// 事件管理器
    pub event_manager: Rc<RefCell<EventManager>>,
    /// 当前 URL
    pub current_url: String,
    /// 页面标题
    pub page_title: String,
    /// 需要重新渲染
    pub needs_redraw: bool,
    /// 是否为调试标签页
    pub is_debug_tab: bool,
}

impl Tab {
    /// 创建新的标签页
    pub fn new(
        engine: Rc<RefCell<Engine>>,
        js_engine: JsEngine,
        dom_bridge: DomApiBridge,
        event_manager: EventManager,
    ) -> Self {
        Tab {
            engine,
            js_engine: Rc::new(RefCell::new(js_engine)),
            dom_bridge: Rc::new(RefCell::new(dom_bridge)),
            event_manager: Rc::new(RefCell::new(event_manager)),
            current_url: String::new(),
            page_title: String::from("New Tab"),
            needs_redraw: true,
            is_debug_tab: false,
        }
    }

    /// 获取标签页的简短标题（用于标签栏显示）
    pub fn short_title(&self) -> String {
        if self.is_debug_tab {
            // 调试标签页显示 "Debug" 或截断的标题
            if self.page_title.is_empty() || self.page_title == "New Tab" {
                return "Debug".to_string();
            } else {
                // 截断标题用于显示
                let title = &self.page_title;
                if title.len() > 15 {
                    return format!("{}...", &title[..12]);
                }
                return title.to_string();
            }
        }
        
        if self.current_url.is_empty() {
            return self.page_title.clone();
        }
        // 使用域名作为简短标题
        if let Ok(url) = url::Url::parse(&self.current_url) {
            if let Some(host) = url.host_str() {
                return host.to_string();
            }
        }
        self.current_url.clone()
    }
}
