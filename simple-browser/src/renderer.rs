use anyhow::{anyhow, Result};
use bytemuck::{Pod, Zeroable};
use log::info;
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;
use wgpu::{Device, Queue, Surface, SurfaceConfiguration};
use winit::dpi::PhysicalSize;
use winit::window::Window;
use webgpu_web_renderer::Engine;
use webgpu_web_renderer::bridge::WebNativeBridge;

/// 工具栏 uniform 数据
#[derive(Clone, Copy, Pod, Zeroable)]
#[repr(C)]
struct ToolbarUniforms {
    toolbar_ratio: f32,
}

/// 渲染器状态
pub struct Renderer {
    surface: Surface<'static>,
    device: Arc<Device>,
    queue: Arc<Queue>,
    config: SurfaceConfiguration,
    size: PhysicalSize<u32>,
    window: Arc<Window>,
}

impl Renderer {
    /// 创建新的渲染器
    pub async fn new(window: Arc<Window>) -> Result<Self> {
        let size = window.inner_size();

        // 创建 wgpu 实例
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        // 创建表面
        let surface = instance.create_surface(window.clone())?;

        // 请求适配器
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::default(),
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| anyhow!("Failed to find an appropriate adapter"))?;

        // 创建设备和队列
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Browser Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                },
                None,
            )
            .await?;

        let device = Arc::new(device);
        let queue = Arc::new(queue);

        // 获取表面能力
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(surface_caps.formats[0]);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width: size.width,
            height: size.height,
            present_mode: surface_caps.present_modes[0],
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };

        surface.configure(&device, &config);

        info!(
            "Renderer created: {}x{}, format={:?}",
            size.width, size.height, surface_format
        );

        Ok(Self {
            surface,
            device,
            queue,
            config,
            size,
            window,
        })
    }

    /// 调整大小
    pub fn resize(&mut self, new_size: PhysicalSize<u32>) {
        if new_size.width > 0 && new_size.height > 0 {
            self.size = new_size;
            self.config.width = new_size.width;
            self.config.height = new_size.height;
            self.surface.configure(&self.device, &self.config);
            info!("Renderer resized to {}x{}", new_size.width, new_size.height);
        }
    }

    /// 获取窗口大小
    pub fn size(&self) -> PhysicalSize<u32> {
        self.size
    }

    /// 获取设备
    pub fn device(&self) -> &Device {
        &self.device
    }

    /// 获取队列
    pub fn queue(&self) -> &Queue {
        &self.queue
    }

    /// 获取表面格式
    pub fn surface_format(&self) -> wgpu::TextureFormat {
        self.config.format
    }

    /// 渲染一帧
    pub fn render(&mut self, render_fn: impl FnOnce(&mut wgpu::CommandEncoder, &wgpu::TextureView)) -> Result<()> {
        let output = self.surface.get_current_texture()?;
        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

        // 执行自定义渲染
        render_fn(&mut encoder, &view);

        // 提交命令
        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();

        Ok(())
    }

    /// 清除屏幕
    pub fn clear(&mut self, color: wgpu::Color) -> Result<()> {
        self.render(|encoder, view| {
            let _render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Clear Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(color),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
        })
    }

    /// 请求窗口重绘
    pub fn request_redraw(&self) {
        self.window.request_redraw();
    }

    /// 获取窗口
    pub fn window(&self) -> &Window {
        &self.window
    }
}

/// 页面渲染器 - 使用 webgpu-web-renderer 渲染网页内容
pub struct PageRenderer {
    renderer: Renderer,
    engine: Rc<RefCell<Engine>>,
    texture: Option<wgpu::Texture>,
    texture_view: Option<wgpu::TextureView>,
    bind_group: Option<wgpu::BindGroup>,
    render_pipeline: Option<wgpu::RenderPipeline>,
    toolbar_uniform_buffer: Option<wgpu::Buffer>,
    /// 工具栏高度（像素）
    toolbar_height: u32,
}

impl PageRenderer {
    /// 创建新的页面渲染器
    pub async fn new(
        window: Arc<Window>,
        engine: Rc<RefCell<Engine>>,
    ) -> Result<Self> {
        let renderer = Renderer::new(window).await?;

        Ok(Self {
            renderer,
            engine,
            texture: None,
            texture_view: None,
            bind_group: None,
            render_pipeline: None,
            toolbar_uniform_buffer: None,
            toolbar_height: 0,
        })
    }

    /// 设置工具栏高度
    pub fn set_toolbar_height(&mut self, height: u32) {
        self.toolbar_height = height;
    }

    /// 获取工具栏高度
    pub fn toolbar_height(&self) -> u32 {
        self.toolbar_height
    }

    /// 替换渲染引擎引用（用于标签页切换）
    pub fn set_engine(&mut self, engine: Rc<RefCell<Engine>>) {
        self.engine = engine;
    }

    /// 初始化渲染资源
    pub fn initialize(&mut self) -> Result<()> {
        let device = self.renderer.device();
        let size = self.renderer.size();
        let content_height = if size.height > self.toolbar_height {
            size.height - self.toolbar_height
        } else {
            size.height
        };

        // 创建网页内容纹理
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Page Texture"),
            size: wgpu::Extent3d {
                width: size.width,
                height: content_height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let texture_view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        // 创建采样器
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Page Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        // 创建工具栏 uniform buffer
        let toolbar_ratio = if size.height > 0 {
            self.toolbar_height as f32 / size.height as f32
        } else {
            0.0
        };
        let toolbar_uniforms = ToolbarUniforms { toolbar_ratio };
        let toolbar_uniform_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Toolbar Uniform Buffer"),
            size: std::mem::size_of::<ToolbarUniforms>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        self.renderer.queue().write_buffer(
            &toolbar_uniform_buffer,
            0,
            bytemuck::cast_slice(&[toolbar_uniforms]),
        );

        // 绑定组布局：binding 0=纹理, 1=采样器, 2=toolbar uniform
        let bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Page Bind Group Layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            multisampled: false,
                            view_dimension: wgpu::TextureViewDimension::D2,
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::VERTEX,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
                ],
            });

        // 创建绑定组（纹理 + 采样器 + toolbar uniform）
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Page Bind Group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: toolbar_uniform_buffer.as_entire_binding(),
                },
            ],
        });

        // 创建渲染管线
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Page Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/page.wgsl").into()),
        });

        let pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("Page Pipeline Layout"),
                bind_group_layouts: &[&bind_group_layout],
                push_constant_ranges: &[],
            });

        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Page Render Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: "vs_main",
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: "fs_main",
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: self.renderer.surface_format(),
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
        });

        self.texture = Some(texture);
        self.texture_view = Some(texture_view);
        self.bind_group = Some(bind_group);
        self.render_pipeline = Some(render_pipeline);
        self.toolbar_uniform_buffer = Some(toolbar_uniform_buffer);

        info!("Page renderer initialized (toolbar_height={})", self.toolbar_height);
        Ok(())
    }

    /// 渲染页面
    pub fn render(&mut self) -> Result<()> {
        // 使用 webgpu-web-renderer 的 render_raw() 跳过 PNG 编解码
        let (rgba_data, img_width, img_height) = {
            let mut engine = self.engine.borrow_mut();
            engine.render_raw().unwrap_or_default()
        };

        if rgba_data.is_empty() {
            log::warn!("PageRenderer: render_raw returned empty, clearing to white");
            return self.renderer.clear(wgpu::Color::WHITE);
        }

        // 更新纹理
        let size = self.renderer.size();
        let content_height = if size.height > self.toolbar_height {
            size.height - self.toolbar_height
        } else {
            size.height
        };

        if let Some(ref texture) = self.texture
            && img_width == size.width && img_height == content_height {
                self.renderer.queue().write_texture(
                    wgpu::ImageCopyTexture {
                        texture,
                        mip_level: 0,
                        origin: wgpu::Origin3d::ZERO,
                        aspect: wgpu::TextureAspect::All,
                    },
                    &rgba_data,
                    wgpu::ImageDataLayout {
                        offset: 0,
                        bytes_per_row: Some(4 * size.width),
                        rows_per_image: Some(content_height),
                    },
                    wgpu::Extent3d {
                        width: size.width,
                        height: content_height,
                        depth_or_array_layers: 1,
                    },
                );
            }

        // 更新工具栏 uniform
        let toolbar_ratio = if size.height > 0 {
            self.toolbar_height as f32 / size.height as f32
        } else {
            0.0
        };

        if let Some(ref uniform_buffer) = self.toolbar_uniform_buffer {
            let uniforms = ToolbarUniforms { toolbar_ratio };
            self.renderer.queue().write_buffer(
                uniform_buffer,
                0,
                bytemuck::cast_slice(&[uniforms]),
            );
        }

        // 渲染到屏幕
        if let (Some(bind_group), Some(render_pipeline)) =
            (self.bind_group.as_ref(), self.render_pipeline.as_ref())
        {
            self.renderer.render(|encoder, view| {
                let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("Page Render Pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view,
                        resolve_target: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::WHITE),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    timestamp_writes: None,
                    occlusion_query_set: None,
                });

                render_pass.set_pipeline(render_pipeline);
                render_pass.set_bind_group(0, bind_group, &[]);
                render_pass.draw(0..6, 0..1);
            })?;
        }

        Ok(())
    }

    /// 调整大小
    pub fn resize(&mut self, new_size: PhysicalSize<u32>) {
        self.renderer.resize(new_size);
        // 重新初始化纹理
        let _ = self.initialize();
    }

    /// 获取渲染器
    pub fn renderer(&self) -> &Renderer {
        &self.renderer
    }

    /// 获取渲染器（可变）
    pub fn renderer_mut(&mut self) -> &mut Renderer {
        &mut self.renderer
    }

    /// 请求重绘
    pub fn request_redraw(&self) {
        self.renderer.request_redraw();
    }
}
