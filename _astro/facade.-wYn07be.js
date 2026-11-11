function e(e,t,n,r,i){let a=e.getContext(`webgl`,{antialias:!1,alpha:!1,powerPreference:`low-power`});if(!a)return null;let o=(e,t)=>{let n=a.createShader(e);return a.shaderSource(n,t),a.compileShader(n),n},s=a.createProgram();if(a.attachShader(s,o(a.VERTEX_SHADER,`attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`)),a.attachShader(s,o(a.FRAGMENT_SHADER,`
precision mediump float;
varying vec2 v;
uniform sampler2D t0, t1, t2, t3, mk;
uniform float ph, t, hovA;
uniform float spu;     // sun course 0 (dawn) .. 1 (noon) .. 2 (dusk) .. 2.6 (set): follows the clock, not the shots
uniform vec2 res;      // canvas size (device px)
uniform vec4 rect;     // image box in canvas px: x, y (from top), w, h
uniform vec4 hov;      // hovered window box in image uv (x, y, w, h)
uniform vec3 bg;       // page colour below the image
uniform float fade;    // portrait screens: the bottom of the image melts into the page
uniform vec2 ptr;      // pointer in image uv
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wgt(float k){ float d = abs(mod(ph - k + 2.0, 4.0) - 2.0); return max(0.0, 1.0 - d); }
vec3 shot(vec2 uv, float w0, float w1, float w2, float w3){
  vec3 c = vec3(0.0);
  if (w0 > 0.0) c += w0 * texture2D(t0, uv).rgb;
  if (w1 > 0.0) c += w1 * texture2D(t1, uv).rgb;
  if (w2 > 0.0) c += w2 * texture2D(t2, uv).rgb;
  if (w3 > 0.0) c += w3 * texture2D(t3, uv).rgb;
  return c;
}
void main(){
  vec2 px = vec2(v.x * res.x, (1.0 - v.y) * res.y);
  vec2 uv = (px - rect.xy) / rect.zw;           // image uv, y down; may go above 0 (extended sky)
  float w0 = wgt(0.0), w1 = wgt(1.0), w2 = wgt(2.0), w3 = wgt(3.0);
  float night = w3;
  if (uv.y > 1.0) { gl_FragColor = vec4(bg, 1.0); return; }
  vec3 col; float sky;
  vec2 suv = vec2(clamp(uv.x, 0.0, 1.0), uv.y);
  float lift = max(0.0, rect.y / rect.w - 0.05);   // sky above the image, in image heights (portrait)
  // Code stars of the extended sky (same density above the image and in its melted top).
  vec2 g = floor(px / 3.0);
  float star = night * step(0.996, h1(g)) * (0.5 + 0.5 * sin(t * 2.0 + h1(g + 7.0) * 30.0));
  if (uv.y < 0.0) {
    // Extended sky: the average of the top row of each shot, deepening upwards, with code stars at night.
    // Near the edge: the top row just above (blurred sideways, so the stars do not streak); higher up: the
    // average of the whole row. Continuous with the image at uv.y = 0.
    vec3 near = vec3(0.0), far = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      near += shot(vec2(clamp(suv.x + 0.02 * float(i - 2), 0.0, 1.0), 0.003), w0, w1, w2, w3);
      far += shot(vec2(0.1 + 0.2 * float(i), 0.003), w0, w1, w2, w3);
    }
    // At night the top row is full of stars: only the row average is used there (no vertical streaks).
    col = mix(near, far, max(night, 0.55 + 0.45 * smoothstep(0.0, 0.18, -uv.y))) / 5.0 * (1.0 - 0.18 * clamp(-uv.y * 2.0, 0.0, 1.0));
    col += star * vec3(0.85, 0.9, 1.0);
    sky = 1.0;
  } else {
    col = shot(uv, w0, w1, w2, w3);
    vec3 m = texture2D(mk, uv).rgb;
    sky = m.g;
    // Portrait: the top of the photo melts into the extended sky (no seam line), stars included.
    if (lift > 0.0 && uv.y < 0.22) {
      vec3 far = vec3(0.0);
      for (int i = 0; i < 5; i++) far += shot(vec2(0.1 + 0.2 * float(i), 0.003), w0, w1, w2, w3);
      float tb = (1.0 - smoothstep(0.0, 0.22, uv.y)) * sky;
      col = mix(col, far / 5.0 + star * vec3(0.85, 0.9, 1.0), tb * mix(0.55, 0.9, night));
    }
    // Stars twinkle: the bright specks of the night sky breathe.
    float lum = dot(col, vec3(0.3, 0.6, 0.1));
    col *= 1.0 + night * sky * smoothstep(0.35, 0.7, lum) * 0.55 * sin(t * 2.6 + h1(floor(uv * 900.0)) * 40.0);
    // Window lights: they breathe at night; the hovered window lights up at any hour.
    vec2 c = hov.xy + hov.zw * 0.5;
    vec2 d = abs(uv - c) / (hov.zw * 0.5 + 0.012);
    float box = 1.0 - smoothstep(0.85, 1.25, max(d.x, d.y));
    float breathe = 0.85 + 0.15 * sin(t * 1.3 + uv.x * 9.0);
    vec3 lamp = vec3(1.0, 0.66, 0.3);
    col += m.r * lamp * (night * 0.22 * breathe + hovA * box * (0.75 - 0.35 * night));
    // A warm reflection follows the pointer on the walls (not in the sky).
    float pd = distance(uv * vec2(1.78, 1.0), ptr * vec2(1.78, 1.0));
    col += (1.0 - sky) * exp(-pd * pd * 30.0) * mix(0.05, 0.12, night) * lamp;
  }
  // The sun travels on an arc (dawn on the right, noon high, dusk on the left); the moon rises at night.
  // Sun keyframes read from the photos: low on the right at dawn, high on the upper left at noon (the shadows
  // fall from there), low on the left over the olive tree at dusk, then it sets. Placed in the visible part of
  // the image (x0..x1) and lifted into the extended sky on portrait screens.
  float sp = spu;
  vec2 k0 = vec2(0.86, 0.36), k1 = vec2(0.34, 0.08), k2 = vec2(0.15, 0.25), k3 = vec2(0.08, 0.5);
  vec2 sun = sp < 0.0 ? k0 + vec2(0.0, -sp * 0.5) : sp < 1.0 ? mix(k0, k1, smoothstep(0.0, 1.0, sp)) : sp < 2.0 ? mix(k1, k2, smoothstep(1.0, 2.0, sp)) : mix(k2, k3, smoothstep(2.0, 2.6, sp));
  float x0 = clamp(-rect.x / rect.z, 0.0, 1.0), x1 = clamp((res.x - rect.x) / rect.z, 0.0, 1.0);
  sun.x = x0 + sun.x * (x1 - x0);
  float y0 = max(0.0, -rect.y / rect.w);            // image rows hidden above the canvas (landscape crop)
  sun.y += y0 * (1.0 - smoothstep(0.2, 0.5, sun.y));
  sun.y -= lift * 0.7 * (1.0 - smoothstep(0.05, 0.4, sun.y));
  float arcTop = 0.07 - lift * 0.7;
  vec2 asp = vec2(rect.z / rect.w, 1.0);
  float ds = distance(uv * asp, sun * asp) * rect.w / res.y;   // in canvas heights (rect.w is the image height)
  float day = (1.0 - night) * (1.0 - smoothstep(2.3, 2.6, sp));
  vec3 sunCol = mix(vec3(1.0, 0.72, 0.5), vec3(1.0, 0.97, 0.88), w1);
  col += sky * day * sunCol * (smoothstep(0.021, 0.015, ds) * 0.75 + exp(-ds * 16.0) * 0.32 + exp(-ds * 4.0) * 0.1);
  vec2 moon = vec2(x0 + 0.2 * (x1 - x0), 0.16 + y0 - lift * 0.6);
  float dm = distance(uv * asp, moon * asp) * rect.w / res.y;
  float disc = smoothstep(0.025, 0.02, dm) * (1.0 - smoothstep(0.024, 0.018, distance(uv * asp, (moon + vec2(0.012, -0.008)) * asp) * rect.w / res.y));
  col += sky * night * (disc * vec3(0.92, 0.94, 1.0) * 0.95 + exp(-dm * 14.0) * vec3(0.5, 0.6, 0.85) * 0.22);
  col = mix(col, bg, fade * smoothstep(0.75, 1.0, uv.y));
  gl_FragColor = vec4(col, 1.0);
}`)),a.linkProgram(s),!a.getProgramParameter(s,a.LINK_STATUS))return console.warn(`facade:`,a.getProgramInfoLog(s),a.getShaderInfoLog(a.getAttachedShaders(s)[1])),null;a.useProgram(s),a.bindBuffer(a.ARRAY_BUFFER,a.createBuffer()),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),a.STATIC_DRAW);let c=a.getAttribLocation(s,`p`);a.enableVertexAttribArray(c),a.vertexAttribPointer(c,2,a.FLOAT,!1,0,0);let l=e=>a.getUniformLocation(s,e),u={ph:l(`ph`),t:l(`t`),hovA:l(`hovA`),res:l(`res`),rect:l(`rect`),hov:l(`hov`),bg:l(`bg`),ptr:l(`ptr`),fade:l(`fade`),spu:l(`spu`)};a.uniform3f(u.bg,...i.bg),[`t0`,`t1`,`t2`,`t3`,`mk`].forEach((e,t)=>a.uniform1i(l(e),t));let d=0,f=n.length+1,p=new Uint8Array([0,0,0,255]),m=(e,t)=>{let n=a.createTexture();a.activeTexture(a.TEXTURE0+t),a.bindTexture(a.TEXTURE_2D,n),a.texImage2D(a.TEXTURE_2D,0,a.RGBA,1,1,0,a.RGBA,a.UNSIGNED_BYTE,p);let r=e=>{a.activeTexture(a.TEXTURE0+t),a.bindTexture(a.TEXTURE_2D,n),a.texImage2D(a.TEXTURE_2D,0,a.RGB,a.RGB,a.UNSIGNED_BYTE,e),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),d+=1,d===f&&i.onReady()},o=()=>{let t=new Image;t.onload=()=>r(t),t.src=e};`createImageBitmap`in window?fetch(e).then(e=>e.blob()).then(e=>createImageBitmap(e)).then(r).catch(o):o()};m(r,4),n.forEach((e,t)=>m(e,t));let h={x:0,y:0,w:1,h:1},g=()=>Math.min(window.devicePixelRatio||1,i.mobile?1.5:1.25),_=()=>{let n=g();e.width=Math.max(2,Math.round(e.clientWidth*n)),e.height=Math.max(2,Math.round(e.clientHeight*n)),a.viewport(0,0,e.width,e.height);let r=e.getBoundingClientRect(),i=t.getBoundingClientRect();Object.assign(h,{x:(i.left-r.left)*n,y:(i.top-r.top)*n,w:i.width*n,h:i.height*n}),a.uniform1f(u.fade,+!!matchMedia(`(max-aspect-ratio: 4/5)`).matches)};_();let v=new ResizeObserver(_);v.observe(e),v.observe(t);let y={ph:0,hovA:0,sp:1},b={x:0,y:0,w:.01,h:.01},x=0,S={x:.5,y:2,tx:.5,ty:2};e.parentElement.addEventListener(`pointermove`,e=>{let n=t.getBoundingClientRect();S.tx=(e.clientX-n.left)/n.width,S.ty=(e.clientY-n.top)/n.height},{passive:!0}),e.parentElement.addEventListener(`pointerleave`,()=>{S.ty=2});let C=!1,w=0,T=performance.now(),E=t=>{C&&(S.x+=(S.tx-S.x)*.08,S.y+=(S.ty-S.y)*.08,y.hovA+=(x-y.hovA)*.12,a.uniform1f(u.ph,(y.ph%4+4)%4),a.uniform1f(u.t,(t-T)/1e3),a.uniform1f(u.hovA,y.hovA),a.uniform1f(u.spu,y.sp),a.uniform2f(u.res,e.width,e.height),a.uniform4f(u.rect,h.x,h.y,h.w,h.h),a.uniform4f(u.hov,b.x,b.y,b.w,b.h),a.uniform2f(u.ptr,S.x,S.y),a.drawArrays(a.TRIANGLES,0,3),w=requestAnimationFrame(E))};return{state:y,hover(e){e?(Object.assign(b,e),x=1):x=0},start(){C||(C=!0,w=requestAnimationFrame(E))},stop(){C=!1,cancelAnimationFrame(w)},loaded:()=>d===f}}export{e as createFacade};