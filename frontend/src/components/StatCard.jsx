import { useNavigate } from "react-router-dom";

export default function StatCard({
  label,
  value,
  accent = "var(--brand)",
  sub,
  to,
}) {
  const navigate = useNavigate();
  const clickable = Boolean(to);

  const handleClick = () => {
    if (to) {
      navigate(to);
    }
  };

  const handleKeyDown = (e) => {
    if (!clickable) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className="stat-card"
      style={{
        "--stat-accent": accent,
        cursor: clickable ? "pointer" : "default",
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="stat-top">
        <span>{label}</span>

        <span className="stat-ring">
          {clickable ? "→" : "○"}
        </span>
      </div>

      <div className="stat-value">
        {value ?? 0}
      </div>

      <div className="stat-sub">
        {sub || (clickable ? "Click to view details" : "Current overview")}
      </div>

      <div className="stat-orb" />
    </div>
  );
}
