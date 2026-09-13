// Inline, stroke-based icons. They take the text colour and scale with it, so
// a status chip, a table cell and a row control all draw from one set.
const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const Check = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const Cross = (props) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Alert = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const Star = ({ filled = false, ...props }) => (
  <svg {...base} width={16} height={16} fill={filled ? "currentColor" : "none"} {...props}>
    <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z" />
  </svg>
);
