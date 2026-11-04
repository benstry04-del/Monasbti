import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mediaAssets } from "../../services/mediaPreloadService";
export default function WebGLStage({
  phase,
  context,
  objectIds,
  onFailure,
}: any) {
  const ref = useRef<HTMLDivElement>(null),
    phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let renderer: any,
      frame = 0,
      disposed = false,
      onscreen = true;
    const textures: any[] = [];
    const disposables: any[] = [];
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(45, 1, 0.1, 30);
      camera.position.set(0, 0, 8);
      scene.add(new THREE.AmbientLight("#fff1df", 2));
      const light = new THREE.DirectionalLight("#f3cba7", 3);
      light.position.set(-3, 5, 5);
      scene.add(light);
      const group = new THREE.Group();
      scene.add(group);
      const sprites: any[] = [];
      const base = new THREE.TextureLoader().load(
        mediaAssets.sprites,
        () => {
          if (disposed) return;
          base.colorSpace = THREE.SRGBColorSpace;
          for (const [i, id] of objectIds.entries()) {
            const texture = base.clone();
            texture.repeat.set(0.238, 0.313);
            texture.offset.set(
              (id % 4) / 4 + 0.006,
              1 - (Math.floor(id / 4) + 1) / 3 + 0.01,
            );
            texture.needsUpdate = true;
            textures.push(texture);
            const mat = new THREE.SpriteMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
              toneMapped: false,
            });
            disposables.push(mat);
            const sprite = new THREE.Sprite(mat);
            sprite.userData.index = i;
            sprite.scale.set(1.2, 1.1, 1);
            group.add(sprite);
            sprites.push(sprite);
          }
        },
        undefined,
        () => {
          if (!disposed) onFailure();
        },
      );
      textures.push(base);
      const segments = 90,
        positions: number[] = [],
        indices: number[] = [],
        edgeA: THREE.Vector3[] = [],
        edgeB: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2,
          x = 2.1 * Math.cos(t),
          y = 0.72 * Math.sin(t) + 0.13 * Math.sin(t * 3),
          z = 0.65 * Math.sin(t);
        const twist = 0.08 * Math.sin(t * 2);
        positions.push(x, y - 0.07, z - twist, x, y + 0.07, z + twist);
        edgeA.push(new THREE.Vector3(x, y - 0.074, z - twist));
        edgeB.push(new THREE.Vector3(x, y + 0.074, z + twist));
        if (i < segments) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const ribbonMaterial = new THREE.MeshStandardMaterial({
        color: "#6F2B33",
        metalness: 0.62,
        roughness: 0.42,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
      });
      const ribbon = new THREE.Mesh(geo, ribbonMaterial);
      ribbon.rotation.z = -0.2;
      ribbon.position.y = -0.1;
      scene.add(ribbon);
      disposables.push(geo, ribbonMaterial);
      for (const points of [edgeA, edgeB]) {
        const g = new THREE.BufferGeometry().setFromPoints(points),
          m = new THREE.LineBasicMaterial({
            color: "#D1A385",
            transparent: true,
            opacity: 0.85,
          });
        const line = new THREE.Line(g, m);
        ribbon.add(line);
        disposables.push(g, m);
      }
      const particlePositions = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        particlePositions.push(
          Math.cos(a) * 2.8,
          Math.sin(a) * 1.9,
          Math.sin(i) * 0.5,
        );
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(particlePositions, 3),
      );
      const pm = new THREE.PointsMaterial({
        color: "#D1A385",
        size: 0.036,
        transparent: true,
        opacity: 0.7,
      });
      const particles = new THREE.Points(pg, pm);
      scene.add(particles);
      disposables.push(pg, pm);
      const resize = () => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      let start = performance.now(),
        spread = 0.1;
      const animate = (now: number) => {
        if (disposed) return;
        const t = (now - start) / 1000,
          p = phaseRef.current;
        const target = ["lock", "assemble"].includes(p)
          ? 0
          : p === "arrival"
            ? 0.12
            : p === "gather"
              ? 0.6
              : 1;
        spread += (target - spread) * 0.065;
        const mobile = innerWidth < 768;
        for (const [i, sprite] of sprites.entries()) {
          if (mobile && i >= 4) {
            sprite.visible = false;
            continue;
          }
          const a = (i / sprites.length) * Math.PI * 2 + t * 0.21 - 0.7;
          sprite.position.set(
            Math.cos(a) * 2.35 * spread,
            Math.sin(a) * 1.65 * spread,
            Math.sin(a) * 0.6,
          );
          sprite.material.opacity = Math.min(1, spread * 1.6);
          const size = (mobile ? 1.25 : 1.1) * (0.45 + 0.55 * spread);
          sprite.scale.set(size, size * 0.94, 1);
          sprite.material.rotation = Math.sin(t * 0.5 + i) * 0.045;
        }
        ribbon.scale.setScalar(0.75 + 0.25 * spread);
        ribbon.material.opacity = spread * 0.75;
        ribbon.rotation.y = Math.sin(t * 0.28) * 0.17;
        particles.material.opacity = spread * 0.55;
        renderer.render(scene, camera);
        if (!document.hidden && onscreen)
          frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      const visibility = () => {
        cancelAnimationFrame(frame);
        if (!document.hidden && onscreen)
          frame = requestAnimationFrame(animate);
      };
      const intersection = new IntersectionObserver(([entry]) => {
        onscreen = entry.isIntersecting;
        visibility();
      });
      intersection.observe(host);
      const lost = (e: Event) => {
        e.preventDefault();
        if (!disposed) onFailure();
      };
      document.addEventListener("visibilitychange", visibility);
      renderer.domElement.addEventListener("webglcontextlost", lost);
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        for (const item of disposables) item.dispose?.();
        textures.forEach((x) => x.dispose?.());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    } catch {
      renderer?.dispose();
      onFailure();
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        renderer?.domElement?.remove();
      };
    }
  }, [context, objectIds]);
  return <div ref={ref} className="webgl-event-stage" aria-hidden="true" />;
}
