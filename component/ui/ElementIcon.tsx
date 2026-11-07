import sprite from "@/public/icon/element-sprite.png";
import atlas from "@/public/icon/element-sprite.json";
import styles from "./ElementIcon.module.css";

type Element = "all" | "火" | "水" | "木" | "光" | "闇";

const frames = new Map(atlas.frames.map((frame) => [frame.name, frame]));

export default function ElementIcon({
  element,
  size = 24,
  className,
}: {
  element: Element;
  size?: number;
  className?: string;
}) {
  const frame = frames.get(element === "all" ? "全" : element)!;
  const contentSize = Math.max(frame.contentWidth, frame.contentHeight);
  return (
    <span
      className={`${styles.icon} ${className ?? ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={element === "all" ? "全属性" : `${element}属性`}
      data-element={element}
    >
      <img
        src={sprite.src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={styles.sheet}
        style={{
          width: `${atlas.width / contentSize * 100}%`,
          height: `${atlas.height / contentSize * 100}%`,
          left: `${((contentSize - frame.contentWidth) / 2 - frame.x - frame.contentX) / contentSize * 100}%`,
          top: `${((contentSize - frame.contentHeight) / 2 - frame.y - frame.contentY) / contentSize * 100}%`,
        }}
      />
    </span>
  );
}
