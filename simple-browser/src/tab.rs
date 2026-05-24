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
    /// URL 历史栈
    pub history: Vec<String>,
    /// 当前在历史栈中的位置
    pub history_index: usize,
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
            history: Vec::new(),
            history_index: 0,
        }
    }

    /// 检查是否可以后退
    pub fn can_go_back(&self) -> bool {
        self.history_index > 0 && !self.history.is_empty()
    }

    /// 检查是否可以前进
    pub fn can_go_forward(&self) -> bool {
        self.history_index < self.history.len().saturating_sub(1)
    }

    /// 后退到上一页，返回上一页的 URL
    pub fn go_back(&mut self) -> Option<String> {
        if self.can_go_back() {
            self.history_index -= 1;
            self.history.get(self.history_index).cloned()
        } else {
            None
        }
    }

    /// 前进到下一页，返回下一页的 URL
    pub fn go_forward(&mut self) -> Option<String> {
        if self.can_go_forward() {
            self.history_index += 1;
            self.history.get(self.history_index).cloned()
        } else {
            None
        }
    }

    /// 添加新的 URL 到历史记录
    /// 如果当前不在历史记录末尾，则截断后面的历史
    pub fn push_history(&mut self, url: String) {
        // 如果当前 URL 与要添加的 URL 相同，则不添加
        if let Some(current) = self.history.get(self.history_index) {
            if current == &url {
                return;
            }
        }

        // 截断当前位置之后的历史
        if self.history_index < self.history.len() {
            self.history.truncate(self.history_index + 1);
        }

        // 添加新 URL
        self.history.push(url);
        self.history_index = self.history.len() - 1;

        // 限制历史记录大小（可选，最多保存 50 条）
        if self.history.len() > 50 {
            let excess = self.history.len() - 50;
            self.history.drain(0..excess);
            self.history_index = self.history_index.saturating_sub(excess);
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
        if let Ok(url) = url::Url::parse(&self.current_url)
            && let Some(host) = url.host_str() {
                return host.to_string();
            }
        self.current_url.clone()
    }
}
