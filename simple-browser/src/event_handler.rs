use log::info;
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use winit::event::{ElementState, MouseButton, WindowEvent};

/// 事件类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EventType {
    Click,
    MouseDown,
    MouseUp,
    MouseMove,
    KeyDown,
    KeyUp,
    Focus,
    Blur,
    Submit,
    Change,
    Load,
}

impl EventType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "click" => Some(EventType::Click),
            "mousedown" => Some(EventType::MouseDown),
            "mouseup" => Some(EventType::MouseUp),
            "mousemove" => Some(EventType::MouseMove),
            "keydown" => Some(EventType::KeyDown),
            "keyup" => Some(EventType::KeyUp),
            "focus" => Some(EventType::Focus),
            "blur" => Some(EventType::Blur),
            "submit" => Some(EventType::Submit),
            "change" => Some(EventType::Change),
            "load" => Some(EventType::Load),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            EventType::Click => "click",
            EventType::MouseDown => "mousedown",
            EventType::MouseUp => "mouseup",
            EventType::MouseMove => "mousemove",
            EventType::KeyDown => "keydown",
            EventType::KeyUp => "keyup",
            EventType::Focus => "focus",
            EventType::Blur => "blur",
            EventType::Submit => "submit",
            EventType::Change => "change",
            EventType::Load => "load",
        }
    }
}

/// 鼠标事件数据
#[derive(Debug, Clone, Copy)]
pub struct MouseEventData {
    pub x: f32,
    pub y: f32,
    pub button: u16, // 0 = left, 1 = middle, 2 = right
    pub buttons: u16,
    pub shift_key: bool,
    pub ctrl_key: bool,
    pub alt_key: bool,
    pub meta_key: bool,
}

impl MouseEventData {
    pub fn new(x: f32, y: f32) -> Self {
        Self {
            x,
            y,
            button: 0,
            buttons: 0,
            shift_key: false,
            ctrl_key: false,
            alt_key: false,
            meta_key: false,
        }
    }
}

/// 键盘事件数据
#[derive(Debug, Clone)]
pub struct KeyboardEventData {
    pub key: String,
    pub code: String,
    pub key_code: u32,
    pub shift_key: bool,
    pub ctrl_key: bool,
    pub alt_key: bool,
    pub meta_key: bool,
    pub repeat: bool,
}

/// 事件处理器类型
pub type EventHandler = Box<dyn Fn(&EventData)>;

/// 事件数据
#[derive(Debug, Clone)]
pub enum EventData {
    Mouse(MouseEventData),
    Keyboard(KeyboardEventData),
    None,
}

/// 事件管理器
pub struct EventManager {
    /// 元素事件处理器: (node_id, event_type) -> handlers
    element_handlers: HashMap<(usize, EventType), Vec<EventHandler>>,
    /// 全局事件处理器
    global_handlers: HashMap<EventType, Vec<EventHandler>>,
    /// 待处理的事件队列
    #[allow(dead_code)]
    pending_events: Vec<(EventType, EventData)>,
    /// 当前鼠标位置
    pub mouse_position: (f32, f32),
    /// 当前聚焦的元素
    focused_element: Option<usize>,
}

impl EventManager {
    pub fn new() -> Self {
        Self {
            element_handlers: HashMap::new(),
            global_handlers: HashMap::new(),
            pending_events: Vec::new(),
            mouse_position: (0.0, 0.0),
            focused_element: None,
        }
    }

    /// 添加元素事件监听器
    pub fn add_element_listener(
        &mut self,
        node_id: usize,
        event_type: EventType,
        handler: EventHandler,
    ) {
        self.element_handlers
            .entry((node_id, event_type))
            .or_insert_with(Vec::new)
            .push(handler);
        info!("Added event listener: node_id={}, event={:?}", node_id, event_type);
    }

    /// 移除元素事件监听器
    pub fn remove_element_listener(&mut self, node_id: usize, event_type: EventType) {
        self.element_handlers.remove(&(node_id, event_type));
    }

    /// 添加全局事件监听器
    pub fn add_global_listener(&mut self, event_type: EventType, handler: EventHandler) {
        self.global_handlers
            .entry(event_type)
            .or_insert_with(Vec::new)
            .push(handler);
    }

    /// 处理 winit 窗口事件
    pub fn handle_window_event(&mut self, event: &WindowEvent) -> Option<ProcessedEvent> {
        match event {
            WindowEvent::MouseInput { state, button, .. } => {
                let (x, y) = self.mouse_position;
                let mouse_data = MouseEventData::new(x, y);

                match (button, state) {
                    (MouseButton::Left, ElementState::Pressed) => {
                        Some(ProcessedEvent::new(EventType::MouseDown, EventData::Mouse(mouse_data)))
                    }
                    (MouseButton::Left, ElementState::Released) => {
                        Some(ProcessedEvent::new(EventType::MouseUp, EventData::Mouse(mouse_data)))
                    }
                    _ => None,
                }
            }
            WindowEvent::CursorMoved { position, .. } => {
                let x = position.x as f32;
                let y = position.y as f32;
                self.mouse_position = (x, y);
                let mouse_data = MouseEventData::new(x, y);
                Some(ProcessedEvent::new(EventType::MouseMove, EventData::Mouse(mouse_data)))
            }
            _ => None,
        }
    }

    /// 触发元素事件
    pub fn trigger_element_event(
        &mut self,
        node_id: usize,
        event_type: EventType,
        data: EventData,
    ) {
        if let Some(handlers) = self.element_handlers.get(&(node_id, event_type)) {
            for handler in handlers {
                handler(&data);
            }
        }

        // 同时触发全局处理器
        self.trigger_global_event(event_type, data);
    }

    /// 触发全局事件
    pub fn trigger_global_event(&mut self, event_type: EventType, data: EventData) {
        if let Some(handlers) = self.global_handlers.get(&event_type) {
            for handler in handlers {
                handler(&data);
            }
        }
    }

    /// 获取当前鼠标位置
    pub fn mouse_position(&self) -> (f32, f32) {
        self.mouse_position
    }

    /// 设置聚焦元素
    pub fn set_focus(&mut self, node_id: Option<usize>) {
        if let Some(old_focus) = self.focused_element {
            self.trigger_element_event(old_focus, EventType::Blur, EventData::None);
        }
        
        self.focused_element = node_id;
        
        if let Some(new_focus) = node_id {
            self.trigger_element_event(new_focus, EventType::Focus, EventData::None);
        }
    }

    /// 获取聚焦元素
    pub fn focused_element(&self) -> Option<usize> {
        self.focused_element
    }
}

impl Default for EventManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 处理过的事件
#[derive(Debug)]
pub struct ProcessedEvent {
    pub event_type: EventType,
    pub data: EventData,
}

impl ProcessedEvent {
    pub fn new(event_type: EventType, data: EventData) -> Self {
        Self { event_type, data }
    }
}

/// 事件处理器桥接 - 连接 winit 事件和 JS 事件
pub struct EventBridge {
    event_manager: Rc<RefCell<EventManager>>,
    js_callbacks: HashMap<(usize, EventType), String>, // node_id + event_type -> JS function name
}

impl EventBridge {
    pub fn new(event_manager: Rc<RefCell<EventManager>>) -> Self {
        Self {
            event_manager,
            js_callbacks: HashMap::new(),
        }
    }

    /// 注册 JS 事件回调
    pub fn register_js_callback(&mut self, node_id: usize, event_type: EventType, js_function: &str) {
        self.js_callbacks.insert((node_id, event_type), js_function.to_string());
    }

    /// 处理点击事件
    pub fn handle_click(&mut self, x: f32, y: f32, hit_test_fn: impl Fn(f32, f32) -> Option<usize>) {
        if let Some(node_id) = hit_test_fn(x, y) {
            info!("Click at ({}, {}) hit node {}", x, y, node_id);
            
            let mut manager = self.event_manager.borrow_mut();
            let mouse_data = MouseEventData::new(x, y);
            manager.trigger_element_event(node_id, EventType::Click, EventData::Mouse(mouse_data));
        }
    }
}
