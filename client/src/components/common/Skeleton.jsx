// Shimmer placeholder shown while data is loading
export default function Skeleton({ className = "", style }) {
  return <div className={`skel ${className}`} style={style} />;
}
