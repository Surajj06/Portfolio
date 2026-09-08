import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';

interface NetworkNode {
  x: number;
  y: number;
  z: number;
  baseY: number;
  phase: number;
  layerIndex: number;
  orange: boolean;
}

interface NetworkLayer {
  x: number;
  count: number;
  name: string;
  nodes: NetworkNode[];
}

interface Point3 {
  x: number;
  y: number;
  z: number;
}

interface Point2 {
  x: number;
  y: number;
  z: number;
  s: number;
}

interface Packet {
  route: NetworkNode[];
  t: number;
  speed: number;
  orange: boolean;
}

/**
 * A 2D-canvas hand-rolled 3D projection — not WebGL/Three.js — matching a
 * pixel-for-pixel reference mockup (see preview.html at the repo root): six
 * named layers (CALLER → STT → ROUTER → LLM → TOOLS → TTS), sparse
 * layer-to-layer edges, "data packets" animated along random end-to-end
 * routes, and a live ROT/DEPTH readout. Drag rotates freely and permanently
 * disables auto-rotate (matching the reference exactly); wheel zooms.
 *
 * Lazy-loaded via `@defer` in systems.component.html. Paused via
 * IntersectionObserver when scrolled out of view, and skips drag/auto-rotate
 * under prefers-reduced-motion or a coarse pointer (mobile).
 */
@Component({
  selector: 'app-systems-network',
  standalone: true,
  templateUrl: './systems-network.component.html',
  styleUrl: './systems-network.component.scss'
})
export class SystemsNetworkComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('coord', { static: true }) coordRef!: ElementRef<HTMLElement>;

  private ctx?: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private raf?: number;
  private io?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private visible = true;
  private allowMotion = true;
  private lastFrameTime = 0;

  private readonly layers: NetworkLayer[] = [
    { x: -4.4, count: 8, name: 'CALLER', nodes: [] },
    { x: -2.8, count: 11, name: 'STT', nodes: [] },
    { x: -1.0, count: 14, name: 'ROUTER', nodes: [] },
    { x: 1.0, count: 12, name: 'LLM', nodes: [] },
    { x: 2.8, count: 8, name: 'TOOLS', nodes: [] },
    { x: 4.3, count: 6, name: 'TTS', nodes: [] }
  ];
  private nodes: NetworkNode[] = [];
  private edges: [NetworkNode, NetworkNode][] = [];
  private routes: NetworkNode[][] = [];
  private packets: Packet[] = [];

  private rotY = -0.28;
  private rotX = 0.12;
  private zoom = 1;
  private dragging = false;
  private autoRotate = true;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.allowMotion = !prefersReducedMotion;

    const canvas = this.canvasRef.nativeElement;
    const host = canvas.parentElement ?? canvas;

    this.buildNetwork();

    this.zone.runOutsideAngular(() => {
      this.setup(canvas);
      this.observeVisibility(host);
      this.observeResize(host);
      if (isFinePointer) this.attachInteraction(canvas);
      this.lastFrameTime = performance.now();
      this.loop(this.lastFrameTime);
    });
  }

  private buildNetwork(): void {
    for (const layer of this.layers) {
      for (let i = 0; i < layer.count; i++) {
        const y = (i / (layer.count - 1) - 0.5) * 5.0 + (Math.random() - 0.5) * 0.35;
        const z = (Math.random() - 0.5) * 2.1;
        const node: NetworkNode = {
          x: layer.x,
          y,
          z,
          baseY: y,
          phase: Math.random() * Math.PI * 2,
          layerIndex: this.layers.indexOf(layer),
          orange: (layer.name === 'ROUTER' || layer.name === 'LLM') && Math.random() > 0.48
        };
        layer.nodes.push(node);
        this.nodes.push(node);
      }
    }

    for (let li = 0; li < this.layers.length - 1; li++) {
      const from = this.layers[li].nodes;
      const to = this.layers[li + 1].nodes;
      from.forEach((a, i) => {
        for (let k = 0; k < 3; k++) {
          this.edges.push([a, to[(i * 2 + k * 3 + li) % to.length]]);
        }
      });
    }

    for (let r = 0; r < 22; r++) {
      const route: NetworkNode[] = [];
      let idx = Math.floor(Math.random() * this.layers[0].nodes.length);
      for (let li = 0; li < this.layers.length; li++) {
        route.push(this.layers[li].nodes[idx % this.layers[li].nodes.length]);
        if (li < this.layers.length - 1) {
          idx = (idx * 2 + r + li) % this.layers[li + 1].nodes.length;
        }
      }
      this.routes.push(route);
    }

    for (let i = 0; i < 18; i++) {
      this.packets.push({
        route: this.routes[i % this.routes.length],
        t: Math.random(),
        speed: 0.06 + Math.random() * 0.09,
        orange: i % 2 === 0
      });
    }
  }

  private setup(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d') ?? undefined;
    this.resize(canvas);
  }

  private resize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    canvas.width = this.width * this.dpr;
    canvas.height = this.height * this.dpr;
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private attachInteraction(canvas: HTMLCanvasElement): void {
    canvas.style.cursor = 'grab';

    canvas.addEventListener('pointerdown', (event) => {
      this.dragging = true;
      this.autoRotate = false;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      this.rotY += (event.clientX - this.lastPointerX) * 0.008;
      this.rotX += (event.clientY - this.lastPointerY) * 0.006;
      this.rotX = Math.max(-0.8, Math.min(0.8, this.rotX));
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
    });

    canvas.addEventListener('pointerup', () => {
      this.dragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoom = Math.max(0.65, Math.min(1.7, this.zoom - event.deltaY * 0.0007));
      },
      { passive: false }
    );
  }

  private observeVisibility(host: Element): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver(([entry]) => (this.visible = entry.isIntersecting), { threshold: 0 });
    this.io.observe(host);
  }

  private observeResize(host: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      this.resize(this.canvasRef.nativeElement);
    });
    this.resizeObserver.observe(host);
  }

  private project(p: Point3): Point2 {
    const cy = Math.cos(this.rotY);
    const sy = Math.sin(this.rotY);
    const cx = Math.cos(this.rotX);
    const sx = Math.sin(this.rotX);
    const x1 = p.x * cy - p.z * sy;
    const z1 = p.x * sy + p.z * cy;
    const y1 = p.y * cx - z1 * sx;
    const z2 = p.y * sx + z1 * cx;
    const depth = 8.5 + z2;
    const scale = (this.width * 0.092 * this.zoom) / depth * 8.5;
    return { x: this.width / 2 + x1 * scale, y: this.height / 2 + y1 * scale, z: z2, s: scale };
  }

  private static lerp(a: Point3, b: Point3, t: number): Point3 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  private static pathPoint(route: NetworkNode[], t: number): Point3 {
    const n = route.length - 1;
    const raw = t * n;
    const i = Math.min(n - 1, Math.floor(raw));
    const f = raw - i;
    return SystemsNetworkComponent.lerp(route[i], route[i + 1], f);
  }

  private line(a: Point2, b: Point2, color: string, width: number, alpha: number): void {
    if (!this.ctx) return;
    this.ctx.strokeStyle = color.replace('ALPHA', String(alpha));
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || !this.ctx) return;

    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    if (this.allowMotion && this.autoRotate && !this.dragging) this.rotY += dt * 0.16;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const glow = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 10,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.48
    );
    glow.addColorStop(0, 'rgba(25,75,92,.16)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.allowMotion) {
      for (const n of this.nodes) {
        n.y = n.baseY + Math.sin(now * 0.001 * (0.8 + n.layerIndex * 0.07) + n.phase) * 0.035;
      }
    }

    const projectedEdges = this.edges
      .map((e): [Point2, Point2] => [this.project(e[0]), this.project(e[1])])
      .sort((a, b) => a[0].z + a[1].z - (b[0].z + b[1].z));
    for (const [a, b] of projectedEdges) {
      const alpha = Math.max(0.07, Math.min(0.35, 0.22 + (a.z + b.z) * 0.02));
      this.line(a, b, 'rgba(34,170,197,ALPHA)', 1, alpha);
    }

    this.routes.forEach((route, ri) => {
      if (ri % 3 !== 0) return;
      for (let j = 0; j < route.length - 1; j++) {
        const a = this.project(route[j]);
        const b = this.project(route[j + 1]);
        this.line(a, b, ri % 2 ? 'rgba(255,104,0,ALPHA)' : 'rgba(52,216,239,ALPHA)', 1.2, 0.18);
      }
    });

    this.nodes
      .map((n) => ({ n, p: this.project(n) }))
      .sort((a, b) => a.p.z - b.p.z)
      .forEach(({ n, p }) => {
        const r = Math.max(2.2, Math.min(6, p.s * 0.045));
        const glowColor = n.orange ? '255,104,0' : '52,216,239';
        ctx.beginPath();
        ctx.fillStyle = `rgba(${glowColor},.12)`;
        ctx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = n.orange ? '#ff6900' : '#35d8ef';
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      });

    if (this.allowMotion) {
      for (const pk of this.packets) {
        pk.t = (pk.t + pk.speed * dt) % 1;
        const p = this.project(SystemsNetworkComponent.pathPoint(pk.route, pk.t));
        const r = Math.max(2.2, Math.min(5.5, p.s * 0.055));
        const c = pk.orange ? '255,104,0' : '52,216,239';
        ctx.beginPath();
        ctx.fillStyle = `rgba(${c},.18)`;
        ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = pk.orange ? '#ff8a3d' : '#9df5ff';
        ctx.arc(p.x, p.y, r * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(160,175,188,.52)';
    for (const layer of this.layers) {
      const p = this.project({ x: layer.x, y: -3.15, z: 0 });
      ctx.fillText(layer.name, p.x - 18, p.y);
    }

    this.coordRef.nativeElement.textContent =
      `ROT: ${(this.rotY * 57.3).toFixed(0)}° / DEPTH: ${(this.zoom * 100).toFixed(0)}%`;
  };

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.io?.disconnect();
    this.resizeObserver?.disconnect();
  }
}
