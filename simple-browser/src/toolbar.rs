//! Windows 原生工具栏模块
//!
//! 使用 Windows API 创建嵌入 winit 窗口的工具栏，包含：
//! - 简化地址栏 (Edit 控件) - 显示简化 URL
//! - 调试面板 (Edit 控件) - 显示完整 URL，可折叠
//! - 后退/前进/刷新/Go 按钮
//! - 调试切换按钮
//! - 标签栏按钮

#[cfg(windows)]
use log::info;

#[cfg(windows)]
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM, TRUE, FALSE};
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{HFONT, CreateFontW, DeleteObject, DEFAULT_CHARSET};
#[cfg(windows)]
use windows::Win32::UI::Controls::{
    WC_EDITW, WC_BUTTONW,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DestroyWindow, MoveWindow, GetWindowTextLengthW,
    GetWindowTextW, SendMessageW, ShowWindow,
    WS_CHILD, WS_VISIBLE, WS_BORDER, WS_TABSTOP,
    BS_PUSHBUTTON, BS_DEFPUSHBUTTON,
    WM_SETFONT, WM_SETTEXT,
    WM_COMMAND,
    EN_SETFOCUS, EN_KILLFOCUS, BN_CLICKED,
    SW_HIDE, SW_SHOW,
    WINDOW_STYLE, WINDOW_EX_STYLE,
};

// EnableWindow 函数声明
#[cfg(windows)]
unsafe extern "system" {
    fn EnableWindow(hwnd: HWND, enable: windows::Win32::Foundation::BOOL) -> windows::Win32::Foundation::BOOL;
}
#[cfg(windows)]
use windows::core::PCWSTR;

/// 工具栏高度（像素）
pub const TOOLBAR_HEIGHT: u32 = 40;
/// 标签栏高度（像素）
pub const TAB_BAR_HEIGHT: u32 = 28;
/// 调试面板高度（像素）
pub const DEBUG_PANEL_HEIGHT: i32 = 100;
/// 按钮宽度
pub const BUTTON_WIDTH: i32 = 60;
/// 按钮高度
pub const BUTTON_HEIGHT: i32 = 24;
/// 按钮间距
pub const BUTTON_MARGIN: i32 = 4;
/// 地址栏左侧偏移（留给导航按钮的空间）
pub const NAV_BUTTONS_WIDTH: i32 = (BUTTON_WIDTH + BUTTON_MARGIN) * 3 + BUTTON_MARGIN;
/// 新标签页按钮宽度
pub const NEW_TAB_BUTTON_WIDTH: i32 = 80;
/// 调试按钮宽度
pub const DEBUG_BUTTON_WIDTH: i32 = 60;
/// 书签按钮宽度
pub const BOOKMARK_BUTTON_WIDTH: i32 = 30;

/// 工具栏结构
#[cfg(windows)]
pub struct Toolbar {
    /// 父窗口句柄
    #[allow(dead_code)]
    parent_hwnd: HWND,
    /// 工具栏容器窗口句柄
    toolbar_hwnd: HWND,
    /// 简化地址栏 Edit 控件句柄
    address_bar_hwnd: HWND,
    /// 调试面板 Edit 控件句柄（显示完整 URL）
    debug_panel_hwnd: HWND,
    /// Go 按钮句柄
    go_button_hwnd: HWND,
    /// 后退按钮句柄
    back_button_hwnd: HWND,
    /// 前进按钮句柄
    forward_button_hwnd: HWND,
    /// 刷新按钮句柄
    refresh_button_hwnd: HWND,
    /// 新标签页按钮句柄
    new_tab_button_hwnd: HWND,
    /// 调试切换按钮句柄
    debug_toggle_hwnd: HWND,
    /// 书签按钮句柄
    bookmark_button_hwnd: HWND,
    /// 书签下拉按钮句柄
    bookmark_dropdown_hwnd: HWND,
    /// 标签按钮句柄列表
    tab_button_hwnds: Vec<HWND>,
    /// 关闭标签页按钮句柄列表
    tab_close_hwnds: Vec<HWND>,
    /// 工具栏基础高度（标签栏 + 工具栏，不含调试面板）
    base_height: u32,
    /// 工具栏总高度（包含调试面板，如果可见）
    total_height: u32,
    /// 字体句柄
    font: HFONT,
    /// 地址栏是否获得焦点
    address_focused: bool,
    /// 调试面板是否获得焦点
    debug_focused: bool,
    /// 调试面板是否可见
    is_debug_visible: bool,
    /// 当前窗口宽度
    current_width: i32,
    /// 当前页面是否已收藏
    is_bookmarked: bool,
    /// 书签菜单回调
    bookmark_callback: Option<Box<dyn Fn(&str)>>,
}

#[cfg(windows)]
impl Toolbar {
    /// 创建工具栏
    pub fn create(parent_hwnd: HWND) -> Result<Self, String> {
        info!("Creating native toolbar...");

        let base_height = TAB_BAR_HEIGHT + TOOLBAR_HEIGHT;
        let total_height = base_height; // 初始不包含调试面板

        // 创建字体
        let font = unsafe {
            CreateFontW(
                -14, 0, 0, 0,
                400, // FW_NORMAL
                0, 0, 0,
                DEFAULT_CHARSET.0 as u32,
                0, 0, 0, 0,
                PCWSTR(wide_string("Segoe UI").as_ptr()),
            )
        };

        // 创建工具栏容器窗口
        let toolbar_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                PCWSTR(wide_string("STATIC").as_ptr()),
                PCWSTR(wide_string("").as_ptr()),
                WS_CHILD | WS_VISIBLE,
                0, 0,
                0, total_height as i32,
                parent_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create toolbar container: {}", e))?
        };

        // 创建简化地址栏
        let address_style: WINDOW_STYLE = WS_CHILD | WS_VISIBLE | WS_BORDER | WS_TABSTOP;
        let address_bar_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_EDITW,
                PCWSTR(wide_string("").as_ptr()),
                address_style,
                NAV_BUTTONS_WIDTH, TAB_BAR_HEIGHT as i32 + 8,
                0, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create address bar: {}", e))?
        };

        // 创建调试面板（初始隐藏）
        let debug_panel_style: WINDOW_STYLE = WS_CHILD | WS_BORDER | WS_TABSTOP;
        let debug_panel_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_EDITW,
                PCWSTR(wide_string("").as_ptr()),
                debug_panel_style,
                BUTTON_MARGIN, (TAB_BAR_HEIGHT + TOOLBAR_HEIGHT) as i32,
                0, DEBUG_PANEL_HEIGHT - 8,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create debug panel: {}", e))?
        };

        // 创建 Go 按钮
        let go_style: WINDOW_STYLE = WINDOW_STYLE(WS_CHILD.0 | WS_VISIBLE.0 | BS_DEFPUSHBUTTON as u32);
        let go_button_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string("Go").as_ptr()),
                go_style,
                0, TAB_BAR_HEIGHT as i32 + 8,
                BUTTON_WIDTH, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create Go button: {}", e))?
        };

        // 创建后退按钮
        let btn_style: WINDOW_STYLE = WINDOW_STYLE(WS_CHILD.0 | WS_VISIBLE.0 | BS_PUSHBUTTON as u32);
        let back_button_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string("<").as_ptr()),
                btn_style,
                BUTTON_MARGIN, TAB_BAR_HEIGHT as i32 + 8,
                BUTTON_WIDTH, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create Back button: {}", e))?
        };

        // 创建前进按钮
        let forward_button_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string(">").as_ptr()),
                btn_style,
                BUTTON_MARGIN * 2 + BUTTON_WIDTH, TAB_BAR_HEIGHT as i32 + 8,
                BUTTON_WIDTH, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create Forward button: {}", e))?
        };

        // 创建刷新按钮
        let refresh_button_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string("R").as_ptr()),
                btn_style,
                BUTTON_MARGIN * 3 + BUTTON_WIDTH * 2, TAB_BAR_HEIGHT as i32 + 8,
                BUTTON_WIDTH, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create Refresh button: {}", e))?
        };

        // 创建调试切换按钮
        let debug_toggle_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string("Debug ▼").as_ptr()),
                btn_style,
                0, TAB_BAR_HEIGHT as i32 + 8,
                DEBUG_BUTTON_WIDTH, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create Debug toggle button: {}", e))?
        };

        // 创建新标签页按钮
        let new_tab_button_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string("+").as_ptr()),
                btn_style,
                0, 2,
                28, (TAB_BAR_HEIGHT - 4) as i32,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create New Tab button: {}", e))?
        };

        // 创建书签按钮（星形）
        let bookmark_button_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string("☆").as_ptr()),
                btn_style,
                0, TAB_BAR_HEIGHT as i32 + 8,
                BOOKMARK_BUTTON_WIDTH, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create Bookmark button: {}", e))?
        };

        // 创建书签下拉按钮
        let bookmark_dropdown_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                WC_BUTTONW,
                PCWSTR(wide_string("▼").as_ptr()),
                btn_style,
                0, TAB_BAR_HEIGHT as i32 + 8,
                24, BUTTON_HEIGHT,
                toolbar_hwnd,
                None,
                windows::Win32::Foundation::HINSTANCE::default(),
                None,
            ).map_err(|e| format!("Failed to create Bookmark dropdown button: {}", e))?
        };

        // 设置字体
        unsafe {
            let _ = SendMessageW(address_bar_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(debug_panel_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(go_button_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(back_button_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(forward_button_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(refresh_button_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(debug_toggle_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(new_tab_button_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(bookmark_button_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
            let _ = SendMessageW(bookmark_dropdown_hwnd, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(TRUE.0 as isize));
        }

        // 初始禁用后退和前进按钮
        unsafe {
            let _ = EnableWindow(back_button_hwnd, FALSE);
            let _ = EnableWindow(forward_button_hwnd, FALSE);
        }

        info!("Native toolbar created successfully");

        Ok(Self {
            parent_hwnd,
            toolbar_hwnd,
            address_bar_hwnd,
            debug_panel_hwnd,
            go_button_hwnd,
            back_button_hwnd,
            forward_button_hwnd,
            refresh_button_hwnd,
            new_tab_button_hwnd,
            debug_toggle_hwnd,
            bookmark_button_hwnd,
            bookmark_dropdown_hwnd,
            tab_button_hwnds: Vec::new(),
            tab_close_hwnds: Vec::new(),
            base_height,
            total_height,
            font,
            address_focused: false,
            debug_focused: false,
            is_debug_visible: false,
            current_width: 0,
            is_bookmarked: false,
            bookmark_callback: None,
        })
    }

    /// 获取简化地址栏文本
    pub fn get_address_text(&self) -> String {
        unsafe {
            let len = GetWindowTextLengthW(self.address_bar_hwnd);
            if len == 0 {
                return String::new();
            }
            let mut buf: Vec<u16> = vec![0; (len + 1) as usize];
            GetWindowTextW(self.address_bar_hwnd, &mut buf);
            String::from_utf16_lossy(&buf[..len as usize])
        }
    }

    /// 设置简化地址栏文本
    pub fn set_address_text(&self, text: &str) {
        unsafe {
            let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let _ = SendMessageW(
                self.address_bar_hwnd,
                WM_SETTEXT,
                WPARAM(0),
                LPARAM(wide.as_ptr() as isize),
            );
        }
    }

    /// 获取调试面板文本（完整 URL）
    pub fn get_debug_text(&self) -> String {
        unsafe {
            let len = GetWindowTextLengthW(self.debug_panel_hwnd);
            if len == 0 {
                return String::new();
            }
            let mut buf: Vec<u16> = vec![0; (len + 1) as usize];
            GetWindowTextW(self.debug_panel_hwnd, &mut buf);
            String::from_utf16_lossy(&buf[..len as usize])
        }
    }

    /// 设置调试面板文本（完整 URL）
    pub fn set_debug_text(&self, text: &str) {
        unsafe {
            let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let _ = SendMessageW(
                self.debug_panel_hwnd,
                WM_SETTEXT,
                WPARAM(0),
                LPARAM(wide.as_ptr() as isize),
            );
        }
    }

    /// 切换调试面板显示/隐藏
    pub fn toggle_debug_panel(&mut self) {
        self.is_debug_visible = !self.is_debug_visible;
        
        unsafe {
            if self.is_debug_visible {
                let _ = ShowWindow(self.debug_panel_hwnd, SW_SHOW);
                // 更新调试按钮文本
                let wide: Vec<u16> = "Debug ▲".encode_utf16().chain(std::iter::once(0)).collect();
                let _ = SendMessageW(
                    self.debug_toggle_hwnd,
                    WM_SETTEXT,
                    WPARAM(0),
                    LPARAM(wide.as_ptr() as isize),
                );
            } else {
                let _ = ShowWindow(self.debug_panel_hwnd, SW_HIDE);
                // 更新调试按钮文本
                let wide: Vec<u16> = "Debug ▼".encode_utf16().chain(std::iter::once(0)).collect();
                let _ = SendMessageW(
                    self.debug_toggle_hwnd,
                    WM_SETTEXT,
                    WPARAM(0),
                    LPARAM(wide.as_ptr() as isize),
                );
            }
        }
        
        // 更新总高度
        self.total_height = if self.is_debug_visible {
            self.base_height + DEBUG_PANEL_HEIGHT as u32
        } else {
            self.base_height
        };
        
        // 重新调整布局
        self.resize(self.current_width);
        
        info!("Debug panel visibility: {}", self.is_debug_visible);
    }

    /// 调试面板是否可见
    pub fn is_debug_visible(&self) -> bool {
        self.is_debug_visible
    }

    /// 获取工具栏总高度
    pub fn height(&self) -> u32 {
        self.total_height
    }

    /// 获取工具栏基础高度（不含调试面板）
    pub fn base_height(&self) -> u32 {
        self.base_height
    }

    /// 调整工具栏大小
    pub fn resize(&mut self, width: i32) {
        self.current_width = width;

        unsafe {
            // 调整工具栏容器大小
            let _ = MoveWindow(
                self.toolbar_hwnd,
                0, 0,
                width, self.total_height as i32,
                TRUE,
            );

            // 计算地址栏宽度（填充剩余空间，考虑书签按钮）
            let address_width = width - NAV_BUTTONS_WIDTH - BUTTON_WIDTH - DEBUG_BUTTON_WIDTH - BOOKMARK_BUTTON_WIDTH - 24 - BUTTON_MARGIN * 4;
            let _ = MoveWindow(
                self.address_bar_hwnd,
                NAV_BUTTONS_WIDTH,
                TAB_BAR_HEIGHT as i32 + 8,
                if address_width > 0 { address_width } else { 100 },
                BUTTON_HEIGHT,
                TRUE,
            );

            // 调整书签按钮位置（在地址栏右侧）
            let bookmark_x = NAV_BUTTONS_WIDTH + address_width + BUTTON_MARGIN;
            let _ = MoveWindow(
                self.bookmark_button_hwnd,
                bookmark_x,
                TAB_BAR_HEIGHT as i32 + 8,
                BOOKMARK_BUTTON_WIDTH,
                BUTTON_HEIGHT,
                TRUE,
            );

            // 调整书签下拉按钮位置
            let bookmark_dropdown_x = bookmark_x + BOOKMARK_BUTTON_WIDTH;
            let _ = MoveWindow(
                self.bookmark_dropdown_hwnd,
                bookmark_dropdown_x,
                TAB_BAR_HEIGHT as i32 + 8,
                24,
                BUTTON_HEIGHT,
                TRUE,
            );

            // 调整调试面板大小
            let debug_width = width - BUTTON_MARGIN * 2;
            let _ = MoveWindow(
                self.debug_panel_hwnd,
                BUTTON_MARGIN,
                (TAB_BAR_HEIGHT + TOOLBAR_HEIGHT) as i32,
                if debug_width > 0 { debug_width } else { 100 },
                DEBUG_PANEL_HEIGHT - 8,
                TRUE,
            );

            // 调整 Go 按钮位置
            let go_x = width - BUTTON_WIDTH - DEBUG_BUTTON_WIDTH - BUTTON_MARGIN * 2;
            let _ = MoveWindow(
                self.go_button_hwnd,
                go_x,
                TAB_BAR_HEIGHT as i32 + 8,
                BUTTON_WIDTH,
                BUTTON_HEIGHT,
                TRUE,
            );

            // 调整调试按钮位置
            let debug_x = width - DEBUG_BUTTON_WIDTH - BUTTON_MARGIN;
            let _ = MoveWindow(
                self.debug_toggle_hwnd,
                debug_x,
                TAB_BAR_HEIGHT as i32 + 8,
                DEBUG_BUTTON_WIDTH,
                BUTTON_HEIGHT,
                TRUE,
            );
        }
    }

    /// 设置后退按钮启用/禁用状态
    pub fn set_back_enabled(&self, enabled: bool) {
        unsafe {
            let _ = EnableWindow(self.back_button_hwnd, if enabled { TRUE } else { FALSE });
        }
    }

    /// 设置前进按钮启用/禁用状态
    pub fn set_forward_enabled(&self, enabled: bool) {
        unsafe {
            let _ = EnableWindow(self.forward_button_hwnd, if enabled { TRUE } else { FALSE });
        }
    }

    /// 设置书签按钮状态（已收藏/未收藏）
    pub fn set_bookmarked(&mut self, is_bookmarked: bool) {
        self.is_bookmarked = is_bookmarked;
        unsafe {
            let text = if is_bookmarked { "★" } else { "☆" };
            let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let _ = SendMessageW(
                self.bookmark_button_hwnd,
                WM_SETTEXT,
                WPARAM(0),
                LPARAM(wide.as_ptr() as isize),
            );
        }
    }

    /// 设置书签菜单回调
    pub fn set_bookmark_callback<F>(&mut self, callback: F)
    where
        F: Fn(&str) + 'static,
    {
        self.bookmark_callback = Some(Box::new(callback));
    }

    /// 显示书签菜单（简化实现：使用消息框或创建简单菜单）
    fn show_bookmark_menu(&self, bookmarks: &[(String, String)]) {
        // 简化实现：通过回调通知浏览器显示书签菜单
        // 实际实现可以使用 Windows 的 TrackPopupMenu
        // 这里我们使用一个简单的对话框或回调来处理
        info!("Bookmark menu requested with {} items", bookmarks.len());
    }

    /// 更新标签按钮
    pub fn update_tabs(&mut self, tab_titles: &[String], _active_index: usize) {
        // 销毁旧的标签按钮
        for hwnd in &self.tab_button_hwnds {
            unsafe { let _ = DestroyWindow(*hwnd); }
        }
        for hwnd in &self.tab_close_hwnds {
            unsafe { let _ = DestroyWindow(*hwnd); }
        }
        self.tab_button_hwnds.clear();
        self.tab_close_hwnds.clear();

        let btn_style: WINDOW_STYLE = WINDOW_STYLE(WS_CHILD.0 | WS_VISIBLE.0 | BS_PUSHBUTTON as u32);
        let mut x_offset = NEW_TAB_BUTTON_WIDTH + BUTTON_MARGIN;

        for title in tab_titles.iter() {
            let display_title = if title.is_empty() { "New Tab" } else { title.as_str() };
            let tab_width = 150i32;

            // 创建标签按钮
            if let Ok(tab_hwnd) = unsafe {
                CreateWindowExW(
                    WINDOW_EX_STYLE(0),
                    WC_BUTTONW,
                    PCWSTR(wide_string(display_title).as_ptr()),
                    btn_style,
                    x_offset, 2,
                    tab_width, (TAB_BAR_HEIGHT - 4) as i32,
                    self.toolbar_hwnd,
                    None,
                    windows::Win32::Foundation::HINSTANCE::default(),
                    None,
                )
            } {
                unsafe {
                    let _ = SendMessageW(tab_hwnd, WM_SETFONT, WPARAM(self.font.0 as usize), LPARAM(TRUE.0 as isize));
                }
                self.tab_button_hwnds.push(tab_hwnd);
            }

            // 创建关闭按钮
            if let Ok(close_hwnd) = unsafe {
                CreateWindowExW(
                    WINDOW_EX_STYLE(0),
                    WC_BUTTONW,
                    PCWSTR(wide_string("X").as_ptr()),
                    btn_style,
                    x_offset + tab_width - 24, 4,
                    20, (TAB_BAR_HEIGHT - 8) as i32,
                    self.toolbar_hwnd,
                    None,
                    windows::Win32::Foundation::HINSTANCE::default(),
                    None,
                )
            } {
                unsafe {
                    let _ = SendMessageW(close_hwnd, WM_SETFONT, WPARAM(self.font.0 as usize), LPARAM(TRUE.0 as isize));
                }
                self.tab_close_hwnds.push(close_hwnd);
            }

            x_offset += tab_width + BUTTON_MARGIN;
        }
    }

    /// 更新特定标签按钮的文本
    pub fn update_tab_button_text(&self, tab_index: usize, title: &str) {
        if tab_index < self.tab_button_hwnds.len() {
            unsafe {
                let wide: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
                let _ = SendMessageW(
                    self.tab_button_hwnds[tab_index],
                    WM_SETTEXT,
                    WPARAM(0),
                    LPARAM(wide.as_ptr() as isize),
                );
            }
        }
    }

    /// 检查地址栏是否获得焦点
    pub fn is_address_focused(&self) -> bool {
        self.address_focused
    }

    /// 检查调试面板是否获得焦点
    pub fn is_debug_focused(&self) -> bool {
        self.debug_focused
    }

    /// 设置地址栏焦点状态
    pub fn set_address_focused(&mut self, focused: bool) {
        self.address_focused = focused;
    }

    /// 设置调试面板焦点状态
    pub fn set_debug_focused(&mut self, focused: bool) {
        self.debug_focused = focused;
    }

    /// 设置地址栏焦点
    pub fn focus_address(&mut self) {
        unsafe {
            // SetFocus from user32.dll
            unsafe extern "system" {
                fn SetFocus(hwnd: HWND) -> HWND;
            }
            SetFocus(self.address_bar_hwnd);
        }
        self.address_focused = true;
    }

    /// 设置调试面板焦点
    pub fn focus_debug(&mut self) {
        unsafe {
            unsafe extern "system" {
                fn SetFocus(hwnd: HWND) -> HWND;
            }
            SetFocus(self.debug_panel_hwnd);
        }
        self.debug_focused = true;
    }

    /// 处理 Windows 消息，返回 Some(ToolbarAction) 表示消息已处理
    pub fn handle_message(&self, msg: u32, wparam: WPARAM, _lparam: LPARAM) -> Option<ToolbarAction> {
        match msg {
            WM_COMMAND => {
                let ctrl_id = loword(wparam.0 as u32) as usize;
                let notify_code = hiword(wparam.0 as u32);

                // 检查是否是按钮点击
                if notify_code == BN_CLICKED {
                    if self.go_button_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::Go);
                    }
                    if self.back_button_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::Back);
                    }
                    if self.forward_button_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::Forward);
                    }
                    if self.refresh_button_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::Refresh);
                    }
                    if self.new_tab_button_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::NewTab);
                    }
                    if self.debug_toggle_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::ToggleDebug);
                    }
                    if self.bookmark_button_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::ToggleBookmark);
                    }
                    if self.bookmark_dropdown_hwnd.0 as usize == ctrl_id {
                        return Some(ToolbarAction::ShowBookmarkMenu);
                    }
                }

                // 检查标签按钮
                for (i, hwnd) in self.tab_button_hwnds.iter().enumerate() {
                    if hwnd.0 as usize == ctrl_id && notify_code == BN_CLICKED {
                        return Some(ToolbarAction::SwitchTab(i));
                    }
                }

                // 检查关闭标签按钮
                for (i, hwnd) in self.tab_close_hwnds.iter().enumerate() {
                    if hwnd.0 as usize == ctrl_id && notify_code == BN_CLICKED {
                        return Some(ToolbarAction::CloseTab(i));
                    }
                }

                // 检查地址栏焦点变化
                if notify_code == EN_SETFOCUS {
                    // 需要在外部设置焦点状态
                } else if notify_code == EN_KILLFOCUS {
                    // 地址栏失去焦点
                }

                None
            }
            _ => None,
        }
    }

    /// 获取 Go 按钮的 HWND
    pub fn go_button_hwnd(&self) -> HWND {
        self.go_button_hwnd
    }

    /// 获取后退按钮的 HWND
    pub fn back_button_hwnd(&self) -> HWND {
        self.back_button_hwnd
    }

    /// 获取前进按钮的 HWND
    pub fn forward_button_hwnd(&self) -> HWND {
        self.forward_button_hwnd
    }

    /// 获取刷新按钮的 HWND
    pub fn refresh_button_hwnd(&self) -> HWND {
        self.refresh_button_hwnd
    }

    /// 获取新标签页按钮的 HWND
    pub fn new_tab_button_hwnd(&self) -> HWND {
        self.new_tab_button_hwnd
    }

    /// 获取调试切换按钮的 HWND
    pub fn debug_toggle_hwnd(&self) -> HWND {
        self.debug_toggle_hwnd
    }

    /// 获取简化地址栏的 HWND
    pub fn address_bar_hwnd(&self) -> HWND {
        self.address_bar_hwnd
    }

    /// 获取调试面板的 HWND
    pub fn debug_panel_hwnd(&self) -> HWND {
        self.debug_panel_hwnd
    }

    /// 获取标签按钮的 HWND 列表
    pub fn tab_button_hwnds(&self) -> &[HWND] {
        &self.tab_button_hwnds
    }

    /// 获取关闭标签按钮的 HWND 列表
    pub fn tab_close_hwnds(&self) -> &[HWND] {
        &self.tab_close_hwnds
    }
}

/// 工具栏操作枚举
#[derive(Debug, Clone)]
pub enum ToolbarAction {
    Go,
    Back,
    Forward,
    Refresh,
    NewTab,
    SwitchTab(usize),
    CloseTab(usize),
    ToggleDebug,
    ToggleBookmark,
    ShowBookmarkMenu,
    OpenBookmark(String),
}

#[cfg(windows)]
impl Drop for Toolbar {
    fn drop(&mut self) {
        unsafe {
            if !self.font.is_invalid() {
                let _ = DeleteObject(self.font);
            }
            for hwnd in &self.tab_button_hwnds {
                let _ = DestroyWindow(*hwnd);
            }
            for hwnd in &self.tab_close_hwnds {
                let _ = DestroyWindow(*hwnd);
            }
            if !self.address_bar_hwnd.is_invalid() {
                let _ = DestroyWindow(self.address_bar_hwnd);
            }
            if !self.debug_panel_hwnd.is_invalid() {
                let _ = DestroyWindow(self.debug_panel_hwnd);
            }
            if !self.go_button_hwnd.is_invalid() {
                let _ = DestroyWindow(self.go_button_hwnd);
            }
            if !self.back_button_hwnd.is_invalid() {
                let _ = DestroyWindow(self.back_button_hwnd);
            }
            if !self.forward_button_hwnd.is_invalid() {
                let _ = DestroyWindow(self.forward_button_hwnd);
            }
            if !self.refresh_button_hwnd.is_invalid() {
                let _ = DestroyWindow(self.refresh_button_hwnd);
            }
            if !self.debug_toggle_hwnd.is_invalid() {
                let _ = DestroyWindow(self.debug_toggle_hwnd);
            }
            if !self.new_tab_button_hwnd.is_invalid() {
                let _ = DestroyWindow(self.new_tab_button_hwnd);
            }
            if !self.bookmark_button_hwnd.is_invalid() {
                let _ = DestroyWindow(self.bookmark_button_hwnd);
            }
            if !self.bookmark_dropdown_hwnd.is_invalid() {
                let _ = DestroyWindow(self.bookmark_dropdown_hwnd);
            }
            if !self.toolbar_hwnd.is_invalid() {
                let _ = DestroyWindow(self.toolbar_hwnd);
            }
        }
    }
}

/// 非 Windows 平台的 stub
#[cfg(not(windows))]
pub struct Toolbar;

#[cfg(not(windows))]
pub const TOOLBAR_HEIGHT: u32 = 40;
#[cfg(not(windows))]
pub const TAB_BAR_HEIGHT: u32 = 28;
#[cfg(not(windows))]
pub const DEBUG_PANEL_HEIGHT: i32 = 100;
#[cfg(not(windows))]
pub const BOOKMARK_BUTTON_WIDTH: i32 = 30;

#[cfg(not(windows))]
#[derive(Debug, Clone)]
pub enum ToolbarAction {
    Go,
    Back,
    Forward,
    Refresh,
    NewTab,
    SwitchTab(usize),
    CloseTab(usize),
    ToggleDebug,
    ToggleBookmark,
    ShowBookmarkMenu,
    OpenBookmark(String),
}

#[cfg(not(windows))]
impl Toolbar {
    pub fn create(_parent_hwnd: *mut std::ffi::c_void) -> Result<Self, String> {
        Ok(Self)
    }

    pub fn get_address_text(&self) -> String {
        String::new()
    }

    pub fn set_address_text(&self, _text: &str) {}

    pub fn get_debug_text(&self) -> String {
        String::new()
    }

    pub fn set_debug_text(&self, _text: &str) {}

    pub fn toggle_debug_panel(&mut self) {}

    pub fn is_debug_visible(&self) -> bool {
        false
    }

    pub fn height(&self) -> u32 {
        TOOLBAR_HEIGHT + TAB_BAR_HEIGHT
    }

    pub fn base_height(&self) -> u32 {
        TOOLBAR_HEIGHT + TAB_BAR_HEIGHT
    }

    pub fn resize(&mut self, _width: i32) {}

    pub fn update_tabs(&mut self, _tab_titles: &[String], _active_index: usize) {}

    pub fn update_tab_button_text(&self, _tab_index: usize, _title: &str) {}

    pub fn is_address_focused(&self) -> bool {
        false
    }

    pub fn is_debug_focused(&self) -> bool {
        false
    }

    pub fn set_address_focused(&mut self, _focused: bool) {}

    pub fn set_debug_focused(&mut self, _focused: bool) {}

    pub fn focus_address(&mut self) {}

    pub fn focus_debug(&mut self) {}

    pub fn set_back_enabled(&self, _enabled: bool) {}

    pub fn set_forward_enabled(&self, _enabled: bool) {}

    pub fn set_bookmarked(&mut self, _is_bookmarked: bool) {}

    pub fn handle_message(&self, _msg: u32, _wparam: usize, _lparam: isize) -> Option<ToolbarAction> {
        None
    }
}

// ── 辅助函数 ──

/// 将字符串转换为宽字符串 (UTF-16, null-terminated)
#[cfg(windows)]
fn wide_string(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// 获取低 16 位
#[cfg(windows)]
fn loword(value: u32) -> u32 {
    value & 0xFFFF
}

/// 获取高 16 位
#[cfg(windows)]
fn hiword(value: u32) -> u32 {
    (value >> 16) & 0xFFFF
}
