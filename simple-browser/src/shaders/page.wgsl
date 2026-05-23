// 页面渲染着色器
// 将网页纹理渲染到全屏四边形（工具栏下方区域）

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) tex_coords: vec2<f32>,
};

// Uniform: 工具栏高度占窗口总高度的比例
struct ToolbarUniforms {
    toolbar_ratio: f32,
};

@group(0) @binding(2)
var<uniform> toolbar: ToolbarUniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    // 生成四边形的顶点（仅在工具栏下方区域）
    // 顶点布局: 0-1-2 (左上, 右上, 左下), 1-3-2 (右上, 右下, 左下)
    let top_y = 1.0 - 2.0 * toolbar.toolbar_ratio;
    var positions = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, top_y),    // 左上（工具栏下方）
        vec2<f32>(1.0, top_y),     // 右上（工具栏下方）
        vec2<f32>(-1.0, -1.0),    // 左下
        vec2<f32>(1.0, -1.0)       // 右下
    );

    var tex_coords = array<vec2<f32>, 4>(
        vec2<f32>(0.0, 0.0),    // 左上
        vec2<f32>(1.0, 0.0),    // 右上
        vec2<f32>(0.0, 1.0),    // 左下
        vec2<f32>(1.0, 1.0)     // 右下
    );

    var indices = array<u32, 6>(
        0u, 1u, 2u,  // 第一个三角形
        1u, 3u, 2u   // 第二个三角形
    );

    let index = indices[vertex_index];

    var output: VertexOutput;
    output.position = vec4<f32>(positions[index], 0.0, 1.0);
    output.tex_coords = tex_coords[index];

    return output;
}

@group(0) @binding(0)
var page_texture: texture_2d<f32>;

@group(0) @binding(1)
var page_sampler: sampler;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return textureSample(page_texture, page_sampler, input.tex_coords);
}
