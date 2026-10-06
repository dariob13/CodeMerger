export default function AnimatedBackdrop() {
  return <div className="animated-backdrop" aria-hidden="true">
    <div className="ambient-light ambient-light-one" />
    <div className="ambient-light ambient-light-two" />
    <div className="ambient-light ambient-light-three" />
    <div className="ambient-grid" />
    <div className="ambient-vignette" />
  </div>;
}
