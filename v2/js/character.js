// Draws a "stacked alpha" video (colour on top, alpha mask below) into a
// WebGL canvas, with hologram / glitch effects used for the spawn animation.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5); // uv.y = 0 at the top
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_glitch;  // 0..1 slice / RGB-split intensity
uniform float u_holo;    // 0..1 hologram look
uniform float u_reveal;  // 0..1 materialise from top to bottom

float hash(float n) { return fract(sin(n) * 43758.5453); }

vec4 sampleChar(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  vec3 c = texture2D(u_tex, vec2(uv.x, uv.y * 0.5)).rgb;
  float a = texture2D(u_tex, vec2(uv.x, 0.5 + uv.y * 0.5)).r;
  return vec4(c, a);
}

void main() {
  vec2 uv = v_uv;
  float t = floor(u_time * 18.0);

  // horizontal slice displacement
  float slice = floor(uv.y * 36.0);
  float r = hash(slice * 13.1 + t);
  uv.x += (r - 0.5) * 0.18 * u_glitch * step(0.72, r);

  // RGB split
  float s = 0.018 * u_glitch;
  vec4 cr = sampleChar(uv + vec2(s, 0.0));
  vec4 cg = sampleChar(uv);
  vec4 cb = sampleChar(uv - vec2(s, 0.0));
  vec3 col = vec3(cr.r, cg.g, cb.b);
  float a = max(cg.a, max(cr.a, cb.a) * u_glitch);

  // hologram tint + scanlines
  float luma = dot(cg.rgb, vec3(0.299, 0.587, 0.114));
  float scan = 0.6 + 0.4 * sin(v_uv.y * 700.0 - u_time * 14.0);
  vec3 holo = vec3(0.25, 0.95, 1.0) * (0.35 + luma * 1.8) * scan;
  col = mix(col, holo, u_holo);
  a *= mix(1.0, 0.45 + 0.4 * scan, u_holo);

  // top-to-bottom materialise with a bright edge
  float edge = u_reveal * 1.15 - 0.05;
  float n = hash(floor(v_uv.x * 90.0) + floor(v_uv.y * 160.0) * 7.0) * 0.05;
  float d = v_uv.y + n - edge;
  float visible = 1.0 - smoothstep(-0.01, 0.0, d);
  float glow = (1.0 - smoothstep(0.0, 0.035, abs(d))) * step(u_reveal, 0.999);
  col += vec3(0.4, 1.0, 1.0) * glow * 1.4 * cg.a;
  a *= visible;
  a = max(a, glow * cg.a);

  gl_FragColor = vec4(col * a, a);
}`;

export class CharacterView {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
    if (!gl) throw new Error("WebGL not available");
    this.gl = gl;
    this.uniforms = { glitch: 0, holo: 0, reveal: 1 };
    this.video = null;

    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.loc = {
      time: gl.getUniformLocation(prog, "u_time"),
      glitch: gl.getUniformLocation(prog, "u_glitch"),
      holo: gl.getUniformLocation(prog, "u_holo"),
      reveal: gl.getUniformLocation(prog, "u_reveal"),
    };

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  setVideo(video) {
    this.video = video;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  render(time) {
    const { gl, video } = this;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!video || video.readyState < 2) return;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.uniform1f(this.loc.time, time);
    gl.uniform1f(this.loc.glitch, this.uniforms.glitch);
    gl.uniform1f(this.loc.holo, this.uniforms.holo);
    gl.uniform1f(this.loc.reveal, this.uniforms.reveal);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
