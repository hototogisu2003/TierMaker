import sprite from "@/public/spot/spot-sprite.png";
import atlas from "@/public/spot/spot-sprite.json";
import type { SpotKey } from "@/lib/teamcustom/types";
import styles from "./SpotIcon.module.css";

const frames = new Map(atlas.frames.map((frame) => [`${frame.name}:${frame.kind}`, frame]));

export default function SpotIcon({
  spot,
  kind,
  className,
  size,
}: {
  spot: SpotKey;
  kind: "main" | "sub";
  className?: string;
  size?: number;
}) {
  const frame = frames.get(`${spot}:${kind}`)!;
  return (
    <span
      className={`${styles.icon} ${className ?? ""}`}
      role="img"
      aria-label={`${spot}${kind === "main" ? "メイン" : "サブ"}`}
      data-spot={spot}
      data-spot-kind={kind}
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${sprite.src}")`,
        backgroundSize: `${atlas.columns * 100}% ${atlas.rows * 100}%`,
        backgroundPosition: `${frame.column / (atlas.columns - 1) * 100}% ${frame.row / (atlas.rows - 1) * 100}%`,
      }}
    />
  );
}
