import sprite from "@/public/soulskill/soulskill-sprite.png";
import atlas from "@/public/soulskill/soulskill-sprite.json";
import styles from "./CrestIcon.module.css";

const frames = new Map(atlas.frames.map((frame) => [`${frame.id}:${frame.grade}`, frame]));

type Props = {
  id: number | null;
  grade: number;
  className?: string;
  alt?: string;
};

export default function CrestIcon({ id, grade, className, alt = "" }: Props) {
  const frame = frames.get(`${id}:${grade}`);
  if (!frame) return null;

  // Crop the original image bounds, excluding the atlas cell's transparent padding.
  // Percentages preserve the existing desktop, mobile and export icon sizes.
  const size = Math.max(frame.contentWidth, frame.contentHeight);
  return (
    <span
      className={`${styles.icon} ${className ?? ""}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-crest-id={id}
      data-crest-grade={grade}
    >
      <img
        src={sprite.src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={styles.sheet}
        style={{
          width: `${atlas.width / size * 100}%`,
          height: `${atlas.height / size * 100}%`,
          left: `${((size - frame.contentWidth) / 2 - frame.x - frame.contentX) / size * 100}%`,
          top: `${((size - frame.contentHeight) / 2 - frame.y - frame.contentY) / size * 100}%`,
        }}
      />
    </span>
  );
}
