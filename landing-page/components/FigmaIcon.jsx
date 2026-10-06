export default function FigmaIcon({ name, className = '' }) {
  return <img src={`/figma/${name}.svg`} alt="" aria-hidden="true" className={`figma-icon ${className}`} />;
}
