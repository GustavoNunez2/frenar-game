/**
 * Pase de post-procesado WebGL en tiempo real sobre el lienzo 2D:
 * - Bloom / Resplandor aditivo para farolas, fuego, neones, ventanas y explosiones.
 * - Onda de choque + aberración cromática sutil al impactar o activar poderes.
 * - Viñeta cinematográfica suave y fundido a negro para "THE END".
 */
export class WebGLPostProcessor {
  private outputCanvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uTexLoc: WebGLUniformLocation | null = null;
  private uTexelLoc: WebGLUniformLocation | null = null;
  private uImpactLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uFadeLoc: WebGLUniformLocation | null = null;
  private fallback2d: CanvasRenderingContext2D | null = null;

  constructor(outputCanvas: HTMLCanvasElement) {
    this.outputCanvas = outputCanvas;
    this.initWebGL();
  }

  private initWebGL(): void {
    const gl =
      this.outputCanvas.getContext('webgl', {
        alpha: false,
        antialias: true,
        preserveDrawingBuffer: false,
      }) ||
      (this.outputCanvas.getContext(
        'experimental-webgl'
      ) as WebGLRenderingContext | null);

    if (!gl) {
      this.fallback2d = this.outputCanvas.getContext('2d');
      return;
    }

    const vsSource = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform vec2 uTexel;
      uniform float uImpact;
      uniform float uTime;
      uniform float uFade;

      void main() {
        vec2 center = vec2(0.5, 0.5);
        vec2 dir = vUv - center;
        float dist = length(dir);

        // Onda de choque y aberración cromática en impactos / poderes
        float wave = sin(dist * 26.0 - uTime * 22.0) * 0.0035 * uImpact;
        vec2 uv = vUv + normalize(dir + 0.0001) * wave;
        float chroma = 0.0042 * uImpact * dist;

        float r = texture2D(uTexture, clamp(uv + vec2(chroma, 0.0), 0.0, 1.0)).r;
        float g = texture2D(uTexture, clamp(uv, 0.0, 1.0)).g;
        float b = texture2D(uTexture, clamp(uv - vec2(chroma, 0.0), 0.0, 1.0)).b;
        vec3 base = vec3(r, g, b);

        // Bloom multi-tap sobre zonas luminosas (luces, fuego, neones, ventanas)
        vec3 bloom = vec3(0.0);
        float spread = 2.6;
        vec2 offsets[8];
        offsets[0] = vec2( 1.0,  0.0);
        offsets[1] = vec2(-1.0,  0.0);
        offsets[2] = vec2( 0.0,  1.0);
        offsets[3] = vec2( 0.0, -1.0);
        offsets[4] = vec2( 0.707,  0.707);
        offsets[5] = vec2(-0.707,  0.707);
        offsets[6] = vec2( 0.707, -0.707);
        offsets[7] = vec2(-0.707, -0.707);

        for (int i = 0; i < 8; i++) {
          vec3 s1 = texture2D(uTexture, clamp(uv + offsets[i] * uTexel * spread, 0.0, 1.0)).rgb;
          vec3 s2 = texture2D(uTexture, clamp(uv + offsets[i] * uTexel * (spread * 2.3), 0.0, 1.0)).rgb;
          float lum1 = dot(s1, vec3(0.299, 0.587, 0.114));
          float lum2 = dot(s2, vec3(0.299, 0.587, 0.114));
          bloom += s1 * smoothstep(0.66, 0.98, lum1) * 0.12;
          bloom += s2 * smoothstep(0.70, 1.0, lum2) * 0.09;
        }

        vec3 color = base + bloom * (0.55 + uImpact * 0.45);

        // Realce sutil de contraste y viñeta suave cinematográfica
        float vig = smoothstep(0.95, 0.34, dist);
        color *= mix(0.84, 1.04, vig);

        // Fundido a negro para cierre cinematográfico
        color *= (1.0 - clamp(uFade, 0.0, 1.0));

        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
    `;

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) {
      this.fallback2d = this.outputCanvas.getContext('2d');
      return;
    }

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.fallback2d = this.outputCanvas.getContext('2d');
      return;
    }

    gl.useProgram(prog);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.gl = gl;
    this.program = prog;
    this.texture = tex;
    this.uTexLoc = gl.getUniformLocation(prog, 'uTexture');
    this.uTexelLoc = gl.getUniformLocation(prog, 'uTexel');
    this.uImpactLoc = gl.getUniformLocation(prog, 'uImpact');
    this.uTimeLoc = gl.getUniformLocation(prog, 'uTime');
    this.uFadeLoc = gl.getUniformLocation(prog, 'uFade');
  }

  private compileShader(
    gl: WebGLRenderingContext,
    type: number,
    src: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public present(
    sourceCanvas: HTMLCanvasElement,
    time: number,
    impact: number,
    fadeBlack: number
  ): void {
    const w = this.outputCanvas.width;
    const h = this.outputCanvas.height;

    if (!this.gl || !this.program || !this.texture) {
      if (this.fallback2d) {
        this.fallback2d.clearRect(0, 0, w, h);
        this.fallback2d.drawImage(sourceCanvas, 0, 0, w, h);
        if (fadeBlack > 0.01) {
          this.fallback2d.fillStyle = `rgba(0,0,0,${Math.min(1, fadeBlack)})`;
          this.fallback2d.fillRect(0, 0, w, h);
        }
      }
      return;
    }

    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sourceCanvas
    );

    if (this.uTexLoc) gl.uniform1i(this.uTexLoc, 0);
    if (this.uTexelLoc) gl.uniform2f(this.uTexelLoc, 1 / Math.max(1, w), 1 / Math.max(1, h));
    if (this.uImpactLoc) gl.uniform1f(this.uImpactLoc, Math.max(0, Math.min(1.5, impact)));
    if (this.uTimeLoc) gl.uniform1f(this.uTimeLoc, time);
    if (this.uFadeLoc) gl.uniform1f(this.uFadeLoc, Math.max(0, Math.min(1, fadeBlack)));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
