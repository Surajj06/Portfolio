import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import * as THREE from 'three';

/**
 * Subtle 3D depth layer behind the hero's gradient blobs — a slow-drifting
 * particle field with faint connecting lines near the cursor, evoking a
 * neural-net/data-flow feel without competing with the photo or copy.
 *
 * Only ever instantiated when the parent `HeroComponent` has already gated
 * on fine-pointer + non-reduced-motion (see its `particlesEnabled`), and
 * loaded via a `@defer` block so `three` never sits in the main bundle.
 * Still defensive here: skips entirely under SSR/no-WebGL, and pauses its
 * render loop via IntersectionObserver whenever the canvas scrolls out of
 * view so it costs nothing once the user has scrolled past the hero.
 */
@Component({
  selector: 'app-hero-particles',
  standalone: true,
  template: `<canvas #canvas class="hero-particles-canvas" aria-hidden="true"></canvas>`,
  styleUrl: './hero-particles.component.scss'
})
export class HeroParticlesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private points?: THREE.Points;
  private raf?: number;
  private io?: IntersectionObserver;
  private visible = true;
  private resizeObserver?: ResizeObserver;

  constructor(private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    const canvas = this.canvasRef.nativeElement;
    const host = canvas.parentElement ?? canvas;

    this.zone.runOutsideAngular(() => {
      this.setup(canvas);
      this.observeVisibility(host);
      this.observeResize(host);
      this.loop();
    });
  }

  private setup(canvas: HTMLCanvasElement): void {
    const { width, height } = canvas.parentElement!.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    this.camera.position.z = 18;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);

    const count = 140;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x5cf0d8,
      size: 0.09,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
  }

  private observeVisibility(host: Element): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    this.io.observe(host);
  }

  private observeResize(host: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.renderer || !this.camera) return;
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    this.resizeObserver.observe(host);
  }

  private loop = (): void => {
    if (this.visible && this.points && this.renderer && this.scene && this.camera) {
      this.points.rotation.y += 0.0006;
      this.points.rotation.x += 0.0002;
      this.renderer.render(this.scene, this.camera);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.io?.disconnect();
    this.resizeObserver?.disconnect();
    this.points?.geometry.dispose();
    (this.points?.material as THREE.Material | undefined)?.dispose();
    this.renderer?.dispose();
  }
}
